import sysPath from 'path';
import childProcess from 'child_process';
import SingleEntryDependency from 'webpack/lib/dependencies/SingleEntryDependency';

export default class StartServerPlugin {
  constructor(options) {
    if (options == null) {
      options = {};
    }
    if (typeof options === 'string') {
      options = {entryName: options};
    }
    this.options = Object.assign(
      {
        // Only listen on keyboard in development, so the server doesn't hang forever
        keyboard: process.env.NODE_ENV === 'development',
      },
      options
    );
    this.entryName = this.options.entryName || 'main';
    this.afterEmit = this.afterEmit.bind(this);
    this.apply = this.apply.bind(this);
    this._handleChildError = this._handleChildError.bind(this);
    this._handleChildExit = this._handleChildExit.bind(this);
    this._handleChildMessage = this._handleChildMessage.bind(this);

    this.worker = null;
    if (this.options.restartable !== false) {
      this._enableRestarting();
    }
  }

  _enableRestarting() {
    if (this.options.keyboard) {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', data => {
        if (data.trim() === 'rs') {
          console.log('Restarting app...');
          process.kill(this.worker.process.pid);
          this._startServer(worker => {
            this.worker = worker;
          });
        }
      });
    }
  }

  _getScript(compilation) {
    const {entryName} = this;
    const entry = compilation.entrypoints[entryName];
    if (!entry) {
      throw new Error(
        `Requested entry "${entryName}" does not exist, try one of: ${Object.keys(
          compilation.entrypoints
        ).join(' ')}`
      );
    }
    const entryScript = entry.chunks[0].files[0];
    const {path} = compilation.outputOptions;
    return sysPath.resolve(path, entryScript);
  }

  _getArgs() {
    const {options} = this;
    const execArgv = (options.nodeArgs || []).concat(process.execArgv);
    return execArgv;
  }

  _handleChildExit(code, signal) {
    if (code) console.error('sswp> script exited with code', code);
    if (signal) console.error('sswp> script exited after signal', signal);

    this.worker = null;

    if (!this.workerLoaded) {
      console.error('sswp> Script did not load or failed HMR, not restarting');
      return;
    }

    this.workerLoaded = false;
    this._runWorker();
  }

  _handleChildError(err) {
    this.worker = null;
  }

  _handleChildMessage(message) {
    if (message === 'SSWP_LOADED') {
      this.workerLoaded = true;
      console.error('sswp> Script loaded');
    } else if (message === 'SSWP_HMR_FAIL') {
      this.workerLoaded = false;
    }
  }

  _runWorker(callback) {
    const {scriptFile, execArgv, options, worker} = this;
    if (worker) return;

    console.warn(
      `sswp> running \`node ${[
        ...execArgv,
        scriptFile,
        '--',
        ...(options.args || []),
      ].join(' ')}\``
    );
    this.worker = childProcess.fork(scriptFile, options.args, {execArgv});
    this.worker.once('exit', this._handleChildExit);
    this.worker.once('error', this._handleChildError);
    this.worker.on('message', this._handleChildMessage);

    if (callback) callback();
  }

  _hmrWorker(compilation, callback) {
    if (this.worker && this.worker.send) {
      this.worker.send('SSWP_HMR');
    }
    callback();
  }

  afterEmit(compilation, callback) {
    if (this.worker) {
      return this._hmrWorker(compilation, callback);
    }

    const scriptFile = this._getScript(compilation);
    const execArgv = this._getArgs();
    this.scriptFile = scriptFile;
    this.execArgv = execArgv;
    this._runWorker(callback);
  }

  apply(compiler) {
    // Not sure if needed but doesn't hurt
    if (!Array.isArray(compiler.options.entries)) {
      compiler.options.entries = [compiler.options.entries];
    }

    let shouldAddMonitor = false;
    const makeHook = (compilation, callback) => {
      shouldAddMonitor = true;
      callback();
    };
    // This runs before compilation starts. We find the server entry and amend it with the monitor
    const buildHook = module => {
      if (!shouldAddMonitor) return;
      if (module.name !== this.entryName) return;
      shouldAddMonitor = false;
      const loaderPath = require.resolve('./monitor-loader');
      module.dependencies.push(
        // Little trick to get our loader to run without source dependencies
        new SingleEntryDependency(`!!${loaderPath}!${loaderPath}`)
      );
      this.monitorAdded = true;
    };
    // Use the Webpack 4 Hooks API when available
    if (compiler.hooks) {
      const plugin = {name: 'StartServerPlugin'};

      compiler.hooks.make.tap(plugin, makeHook);
      compiler.hooks.compilation.tap(compilation =>
        compilation.hooks.buildModule.tap(plugin, buildHook)
      );
      compiler.hooks.afterEmit.tapAsync(plugin, this.afterEmit);
    } else {
      compiler.plugin('make', makeHook);
      compiler.plugin('compilation', compilation => {
        compilation.plugin('build-module', buildHook);
      });
      compiler.plugin('after-emit', this.afterEmit);
    }
  }
}

module.exports = StartServerPlugin;
