import sysPath from 'path';
import childProcess from 'child_process';
import webpack from 'webpack';

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
        verbose: true, // print server logs
        debug: false, // print server errors
        entryName: 'main', // What to run
        once: false, // Run once and exit when worker exits
        nodeArgs: [], // Node arguments for worker
        scriptArgs: [], // Script arguments for worker
        signal: false, // Send a signal instead of a message
        // Only listen on keyboard in development, so the server doesn't hang forever
        restartable: process.env.NODE_ENV === 'development',
      },
      options
    );
    if (!Array.isArray(this.options.scriptArgs)) {
      throw new Error('options.args has to be an array of strings');
    }
    if (this.options.signal === true) {
      this.options.signal = 'SIGUSR2';
      this.options.inject = false;
    }
    this.afterEmit = this.afterEmit.bind(this);
    this.apply = this.apply.bind(this);
    this._handleChildError = this._handleChildError.bind(this);
    this._handleChildExit = this._handleChildExit.bind(this);
    this._handleChildMessage = this._handleChildMessage.bind(this);

    this.worker = null;
    if (this.options.restartable && !options.once) {
      this._enableRestarting();
    }
  }

  _log(msg) {
    if (this.options.verbose) console.log(msg);
  }

  _error(msg) {
    if (this.options.debug) console.error(msg);
  }

  _warn(msg) {
    if (this.options.verbose) console.warn(msg);
  }

  _enableRestarting() {
    this._log('sswp> Type `rs<Enter>` to restart the worker');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', data => {
      if (data.trim() === 'rs') {
        if (this.worker) {
          this._log('sswp> Killing worker...');
          process.kill(this.worker.pid);
        } else {
          this._runWorker();
        }
      }
    });
  }

  _getScript(compilation) {
    const {entryName} = this.options;
    const entrypoints = compilation.entrypoints;
    const entry = entrypoints.get ? entrypoints.get(entryName) : entrypoints[entryName];
    if (!entry) {
      this._error('Empty compilation.entrypoints');
      this._log(compilation);
      throw new Error(
        `Requested entry "${entryName}" does not exist, try one of: ${(entrypoints.keys
          ? entrypoints.keys()
          : Object.keys(entrypoints)
        ).join(' ')}`
      );
    }

    const entryScript = webpack.EntryPlugin ?
      entry.runtimeChunk.files.values().next().value :
      entry.chunks[0].files[0];
    if (!entryScript) {
      this._error('Entry chunk not outputted', entry);
      return;
    }
    const {path} = compilation.outputOptions;
    return sysPath.resolve(path, entryScript);
  }

  _getExecArgv() {
    const {options} = this;
    const execArgv = (options.nodeArgs || []).concat(process.execArgv);
    return execArgv;
  }

  _handleChildExit(code, signal) {
    if (code) this._error('sswp> script exited with code', code);
    if (signal) this._error('sswp> script exited after signal', signal);

    this.worker = null;

    if (!this.workerLoaded) {
      this._error('sswp> Script did not load or failed HMR, not restarting');
      return;
    }
    if (this.options.once) {
      this._error('sswp> Only running script once, as requested');
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
      this._error('sswp> Script loaded');
      if (process.env.NODE_ENV === 'test'&&this.options.once) {
        process.kill(this.worker.pid);
      }
    } else if (message === 'SSWP_HMR_FAIL') {
      this.workerLoaded = false;
    }
  }

  _runWorker(callback) {
    if (this.worker) return;
    const {
      scriptFile,
      options: {scriptArgs},
    } = this;

    const execArgv = this._getExecArgv();

    const cmdline = [...execArgv, scriptFile, '--', ...scriptArgs].join(' ');
    this._warn(`sswp> running \`node ${cmdline}\``);

    const worker = childProcess.fork(scriptFile, scriptArgs, {execArgv, silent: true });
    worker.once('exit', this._handleChildExit);
    worker.once('error', this._handleChildError);
    worker.on('message', this._handleChildMessage);
    worker.stdout.on('data', (data) => {
      this._log(data.toString());
    });
    worker.stderr.on('data', (data) => {
      this._error(data.toString());
    });
    this.worker = worker;

    if (callback) callback();
  }

  _hmrWorker(compilation, callback) {
    const {
      worker,
      options: {signal},
    } = this;
    if (signal) {
      process.kill(worker.pid, signal);
    } else if (worker.send) {
      worker.send('SSWP_HMR');
    } else {
      this._error('sswp> hot reloaded but no way to tell the worker');
    }
    callback();
  }

  afterEmit(compilation, callback) {
    this.scriptFile = this._getScript(compilation);

    if (this.worker) {
      return this._hmrWorker(compilation, callback);
    }

    if (!this.scriptFile) return;

    this._runWorker(callback);
  }

  _getMonitor() {
    const loaderPath = require.resolve('./monitor-loader');
    return `!!${loaderPath}!${loaderPath}`;
  }

  _amendEntry(entry) {
    if (typeof entry === 'function')
      return (...args) =>
        Promise.resolve(entry(...args)).then(this._amendEntry.bind(this));

    const monitor = this._getMonitor();
    if (typeof entry === 'string') return [entry, monitor];
    if (Array.isArray(entry)) return [...entry, monitor];
    if (typeof entry === 'object') {
      return Object.assign({}, entry, {
        [this.options.entryName]: this._amendEntry(
          entry[this.options.entryName]
        ),
      });
    }
    throw new Error('sswp> Cannot parse webpack `entry` option');
  }

  apply(compiler) {
    // Use the Webpack 4 Hooks API when available
    if (compiler.hooks) {
      const plugin = {name: 'StartServerPlugin'};
      // Use the Webpack 5 Hooks API when available
      if (webpack.version && parseInt(webpack.version[0]) >= 5) {
        compiler.hooks.make.tap(plugin, (compilation) => {
          compilation.addEntry(
            compilation.compiler.context,
            webpack.EntryPlugin.createDependency(this._getMonitor(), {name: this.options.entryName}),
            this.options.entryName,
            () => {}
          )
        });
      } else {
        compiler.options.entry = this._amendEntry(compiler.options.entry);
      }
      compiler.hooks.afterEmit.tapAsync(plugin, this.afterEmit);
    } else {
      compiler.options.entry = this._amendEntry(compiler.options.entry);
      compiler.plugin('after-emit', this.afterEmit);
    }
  }
}

module.exports = StartServerPlugin;
