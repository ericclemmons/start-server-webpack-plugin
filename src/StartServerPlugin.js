import cluster from 'cluster';

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

    this.worker = null;
    if (this.options.restartable !== false) {
      this._enableRestarting();
    }
    this.emitted = {};
    this.compilers = 0;
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

  _getExecArgv() {
    const {options} = this;
    const execArgv = (options.nodeArgs || []).concat(process.execArgv);
    return execArgv;
  }

  _getArgs() {
    const { options } = this;
    const argv = (options.args || []);
    return argv;
  }

  _getInspectPort(execArgv) {
    const inspectArg = execArgv.find(arg => arg.includes('--inspect'));
    if (!inspectArg || !inspectArg.includes('=')) {
      return;
    }
    const hostPort = inspectArg.split('=')[1];
    const port = hostPort.includes(':') ? hostPort.split(':')[1] : hostPort;
    return parseInt(port);
  }

  _getSignal() {
    const {signal} = this.options;
    // allow users to disable sending a signal by setting to `false`...
    if (signal === false) return;
    if (signal === true) return 'SIGUSR2';
    return signal;
  }

  afterEmit(name, compilation, callback) {
    if (this.worker && this.worker.isConnected()) {
      const signal = this._getSignal();
      if (signal) {
        process.kill(this.worker.process.pid, signal);
      }
      return callback();
    }

    this.emitted[name] = true;
    this.startServer(compilation, callback);
  }

  apply(compiler) {
    const afterEmit = this.afterEmit.bind(this, `${compiler.options.name || 'StartServerPlugin'}-${this.compilers++}`);
    // Use the Webpack 4 Hooks API when possible.
    if (compiler.hooks) {
      const plugin = {name: 'StartServerPlugin'};

      compiler.hooks.afterEmit.tapAsync(plugin, afterEmit);
    } else {
      compiler.plugin('after-emit', afterEmit);
    }
  }

  startServer(compilation, callback) {
    const {options, compilers, _entryPoint, emitted} = this;

    if (
      !_entryPoint
      && (
        !options.compilation
        || compilation.name === options.compilation
      )
    ) {
      let name;
      const names = Object.keys(compilation.assets);

      if (options.name) {
        if (compilation.assets[options.name]) {
          name = options.name;
        } else if (compilers === 1 || options.compilation) {
          console.error(
            'Entry ' + options.name + ' not found. Try one of: ' + names.join(' ')
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

        if (compilers > 1) {
          console.log(
            'More than one compiler ( '+ compilers + ' ) are used' +
              ( compilation.name
                ? ', selected ' + compilation.name
                : ''
              )
          );
        }
      }

      if (name) {
        const {existsAt} = compilation.assets[name];
        this._entryPoint = existsAt;
      }
    }

    if (Object.keys(emitted).length === compilers) {
      if (!this._entryPoint) {
        console.error('Could not found any valid script to run');
        callback();
      } else {
        this._startServer(worker => {
          this.worker = worker;
          callback();
        });
      }
    } else {
      callback();
    }
  }

  _startServer(callback) {
    const args = this._getArgs();
    const execArgv = this._getExecArgv();
    const inspectPort = this._getInspectPort(execArgv);

    const clusterOptions = {
      exec: this._entryPoint,
      execArgv,
      args,
    };

    if (inspectPort) {
      clusterOptions.inspectPort = inspectPort;
    }
    cluster.setupMaster(clusterOptions);

    cluster.on('online', worker => {
      callback(worker);
    });

    cluster.fork();
  }
}

module.exports = StartServerPlugin;
