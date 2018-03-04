import cluster from "cluster";

export default class StartServerPlugin {
  constructor(options) {
    if (options == null) {
      options = {};
    }
    if (typeof options === 'string') {
      options = {name: options};
    }
    this.options = options;
    this.afterEmit = this.afterEmit.bind(this);
    this.apply = this.apply.bind(this);
    this.startServer = this.startServer.bind(this);

    this.worker = null;
  }

  _getArgs() {
    const {options} = this;
    const execArgv = (options.nodeArgs || []).concat(process.execArgv);
    if (options.args) {
      execArgv.push('--');
      execArgv.push.apply(execArgv, options.args);
    }
    return execArgv;
  }

  _getInspectPort(execArgv) {
    const inspectArg = execArgv.find(arg => arg.includes('--inspect'))
    if (!inspectArg || !inspectArg.includes('=')) {
      return;
    }
    const hostPort = inspectArg.split('=')[1]
    const port = hostPort.includes(':') ? hostPort.split(':')[1] : hostPort;
    return parseInt(port)
  }

  _getSignal() {
    const { signal } = this.options;
    // allow users to disable sending a signal by setting to `false`...
    if (signal === false) {
      return;
    }
    return signal || 'SIGUSR2';
  }

  afterEmit(compilation, callback) {
    if (this.worker && this.worker.isConnected()) {
      const signal = this._getSignal();
      if (signal) {
        process.kill(this.worker.process.pid, signal);
      }
      return callback();
    }

    this.startServer(compilation, callback);
  }

  apply(compiler) {
    // Use the Webpack 4 Hooks API when possible.
    if (compiler.hooks) {
      const plugin = { name: "StartServerPlugin" };

      compiler.hooks.afterEmit.tapAsync(plugin, this.afterEmit)
    } else {
      compiler.plugin("after-emit", this.afterEmit);
    }
  }

  startServer(compilation, callback) {
    const {options} = this;
    let name;
    const names = Object.keys(compilation.assets);
    if (options.name) {
      name = options.name;
      if (!compilation.assets[name]) {
        console.error("Entry " + name + " not found. Try one of: " + names.join(" "));
      }
    } else {
      name = names[0];
      if (names.length > 1) {
        console.log("More than one entry built, selected " + name + ". All names: " + names.join(" "));
      }
    }
    const { existsAt } = compilation.assets[name];
    const execArgv = this._getArgs();
    const inspectPort = this._getInspectPort(execArgv)

    const clusterOptions = {
      exec: existsAt,
      execArgv,
    };

    if (inspectPort) {
      clusterOptions.inspectPort = inspectPort
    }

    cluster.setupMaster(clusterOptions);

    cluster.on("online", (worker) => {
      this.worker = worker;
      callback();
    });

    cluster.fork();
  }
}

module.exports = StartServerPlugin;
