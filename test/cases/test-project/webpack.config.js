const path = require('path');
const webpack = require('webpack');
const StartServerPlugin = require('../../..');

const is_test = process.env.NODE_ENV == 'test';

module.exports = {
  mode: 'development',
  watch: !is_test,
  entry: {main: __dirname},
  target: 'node',
  plugins: [
    new StartServerPlugin({once: true, verbose: !is_test, debug: !is_test}),
  ],
  output: {
    path: path.resolve(__dirname, '..', '..', 'js', 'test-project'),
    filename: 'server.js',
  },
};
