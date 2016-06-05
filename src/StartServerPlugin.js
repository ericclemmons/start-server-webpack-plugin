import cluster from "cluster";

export default class StartServerPlugin {
  constructor() {
    this.afterEmit = this.afterEmit.bind(this);
    this.apply = this.apply.bind(this);
    this.startServer = this.startServer.bind(this);

    this.worker = null;
  }

  afterEmit(compilation, callback) {
    if (this.worker && this.worker.isConnected()) {
      return callback();
    }

    this.startServer(compilation, callback);
  }

  apply(compiler) {
    compiler.plugin("after-emit", this.afterEmit);
  }

  startServer(compilation, callback) {
    const entry = Object.keys(compilation.assets).shift();
    const { existsAt } = compilation.assets[entry];

    cluster.setupMaster({ exec: existsAt });

    cluster.on("online", (worker) => {
      this.worker = worker;
      callback();
    });

    cluster.fork();
  }
}
