import childProcess from 'child_process';

export default class StartServerPlugin {
  constructor(options) {
    if (options == null) {
      options = {};
    }
    if (typeof options === 'string') {
      options = {name: options};
    }
    this.options = Object.assign(
      {
        signal: false,
        // Only listen on keyboard in development, so the server doesn't hang forever
        keyboard: process.env.NODE_ENV === 'development',
      },
      options
    );
    this.afterEmit = this.afterEmit.bind(this);
    this.apply = this.apply.bind(this);
    this.startServer = this.startServer.bind(this);
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
      console.error('sswp> Script did not load, not restarting');
      return;
    }

    this.workerLoaded = false;
    this._runWorker();
  }

  _handleChildError(err) {
    this.worker = null;
  }

  _handleChildMessage(message) {
    console.warn('sswp> got', message);
    if (message === 'SSWP_LOADED') {
      this.workerLoaded = true;
    } else if (message === 'SSWP_HMR_FAIL') {
      this.workerLoaded = false;
    }
  }

  _runWorker(callback) {
    const {existsAt, execArgv, options, worker} = this;
    if (worker) return;

    console.warn('sswp> running script');
    this.worker = childProcess.fork(existsAt, options.args, {execArgv});
    this.worker.once('exit', this._handleChildExit);
    this.worker.once('error', this._handleChildError);
    this.worker.on('message', this._handleChildMessage);

    if (callback) callback();
  }

  _hmrWorker(compilation, callback) {
    if (this.worker && this.worker.send) {
      console.warn('sswp> notifying worker');
      this.worker.send('SSWP_HMR');
    }
    callback();
  }

  afterEmit(compilation, callback) {
    if (this.worker) {
      return this._hmrWorker(compilation, callback);
    }

    this.startServer(compilation, callback);
  }

  apply(compiler) {
    // Use the Webpack 4 Hooks API when possible.
    if (compiler.hooks) {
      const plugin = {name: 'StartServerPlugin'};

      compiler.hooks.afterEmit.tapAsync(plugin, this.afterEmit);
    } else {
      compiler.plugin('after-emit', this.afterEmit);
    }
  }

  startServer(compilation, callback) {
    const {options} = this;
    let name;
    const names = Object.keys(compilation.assets);
    if (options.name) {
      name = options.name;
      if (!compilation.assets[name]) {
        console.error(
          'Entry ' + name + ' not found. Try one of: ' + names.join(' ')
        );
      }
    } else {
      name = names[0];
      if (names.length > 1) {
        console.log(
          'More than one entry built, selected ' +
            name +
            '. All names: ' +
            names.join(' ')
        );
      }
    }
    const {existsAt} = compilation.assets[name];
    const execArgv = this._getArgs();
    this.existsAt = existsAt;
    this.execArgv = execArgv;
    this._runWorker(callback);
  }
}

module.exports = StartServerPlugin;
