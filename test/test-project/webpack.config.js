const sysPath = require('path');
const root = process.cwd();
const StartServerPlugin = require(root);

module.exports = {
  mode: 'development',
  entry: sysPath.join(root, 'test', 'test-project'),
  target: 'node',
  plugins: [new StartServerPlugin({once: true})],
  output: {
    path: sysPath.join(root, 'node_modules', '.build'),
    filename: 'server.js',
  },
};
