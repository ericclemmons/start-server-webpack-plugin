import cluster from "cluster";

export default class StartServerPlugin {
  constructor(entry) {
    this.entry = entry;
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
    let entry;
    const entries = Object.keys(compilation.assets);
    if (this.entry) {
      entry = this.entry;
      if (!compilation.assets[entry]) {
        console.error("Entry " + entry + " not found. Try one of: " + entries.join(" "));
      }
    } else {
      entry = entries[0];
      if (entries.length > 1) {
        console.log("More than one entry built, selected " + entry + ". All entries: " + entries.join(" "));
      }
    }
    const { existsAt } = compilation.assets[entry];

    cluster.setupMaster({ exec: existsAt });

    cluster.on("online", (worker) => {
      this.worker = worker;
      callback();
    });

    cluster.fork();
  }
}

module.exports = StartServerPlugin;
