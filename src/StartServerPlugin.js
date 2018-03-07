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
        entryName: 'main',
        // Only listen on keyboard in development, so the server doesn't hang forever
        keyboard: process.env.NODE_ENV === 'development',
      },
      options
    );
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
    const {entryName} = this.options;
    const map = compilation.entrypoints;
    const entry = map.get ? map.get(entryName) : map[entryName];
    if (!entry) {
      console.log(compilation);
      throw new Error(
        `Requested entry "${entryName}" does not exist, try one of: ${(map.keys
          ? map.keys()
          : Object.keys(map)
        ).join(' ')}`
      );
    }
    const entryScript = entry.chunks[0].files[0];
    if (!entryScript) {
      console.error('Entry chunk not outputted', entry.chunks[0]);
      return;
    }
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
    if (!scriptFile) return;
    const execArgv = this._getArgs();
    this.scriptFile = scriptFile;
    this.execArgv = execArgv;
    this._runWorker(callback);
  }

  _amendEntry(entry) {
    if (typeof entry === 'function')
      return (...args) =>
        Promise.resolve(entry(...args)).then(this._amendEntry.bind(this));

    const loaderPath = require.resolve('./monitor-loader');
    const monitor = `!!${loaderPath}!${loaderPath}`;
    if (typeof entry === 'string') return [entry, monitor];
    if (Array.isArray(entry)) return [...entry, monitor];
    if (typeof entry === 'object')
      return Object.assign({}, entry, {
        [this.options.entryName]: this._amendEntry(
          entry[this.options.entryName]
        ),
      });
    throw new Error('sswp> Cannot parse webpack `entry` option');
  }

  apply(compiler) {
    // Not sure if needed but doesn't hurt
    if (!Array.isArray(compiler.options.entries)) {
      compiler.options.entries = [compiler.options.entries];
    }

    compiler.options.entry = this._amendEntry(compiler.options.entry);

    // Use the Webpack 4 Hooks API when available
    if (compiler.hooks) {
      const plugin = {name: 'StartServerPlugin'};

      compiler.hooks.afterEmit.tapAsync(plugin, this.afterEmit);
    } else {
      compiler.plugin('after-emit', this.afterEmit);
    }
  }
}

module.exports = StartServerPlugin;
