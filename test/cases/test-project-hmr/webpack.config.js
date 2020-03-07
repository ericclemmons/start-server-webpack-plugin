const path = require('path');
const webpack = require('webpack');
const StartServerPlugin = require('../../..');

const is_test = process.env.NODE_ENV == 'test';

module.exports = {
  mode: 'development',
  watch: !is_test,
  entry: { main:  [ __dirname, 'webpack/hot/poll?300', 'webpack/hot/signal' ] },
  target: 'node',
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new StartServerPlugin({once: is_test, verbose: !is_test, debug:  !is_test})
  ],
  output: {
    path: path.resolve(__dirname, '..', '..', 'js', 'test-project-hmr'),
    filename: 'server.js',
  },
};
