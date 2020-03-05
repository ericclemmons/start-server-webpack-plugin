const path = require('path');
const StartServerPlugin = require('../../..');

const is_test = process.env.NODE_ENV == 'test';

module.exports = {
  mode: 'development',
  entry: { main: __dirname },
  target: 'node',
  plugins: [new StartServerPlugin({once: is_test, quiet: is_test })],
  output: {
    path: path.resolve(__dirname, '..', '..', 'js', 'test-project'),
    filename: '[name].js',
  },
};
