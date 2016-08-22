# start-server-webpack-plugin

> Automatically start your server once Webpack's build completes.

[![travis build](https://img.shields.io/travis/ericclemmons/start-server-webpack-plugin.svg)](https://travis-ci.org/ericclemmons/start-server-webpack-plugin)
[![version](https://img.shields.io/npm/v/start-server-webpack-plugin.svg)](http://npm.im/estart-server-webpack-plugin)
[![downloads](https://img.shields.io/npm/dm/start-server-webpack-plugin.svg)](http://npm-stat.com/charts.html?package=start-server-webpack-plugin)
[![MIT License](https://img.shields.io/npm/l/start-server-webpack-plugin.svg)](http://opensource.org/licenses/MIT)

### Installation

```shell
$ npm install --save-dev start-server-webpack-plugin
```

### Usage

In `webpack.config.server.babel.js`:

```js
import StartServerPlugin from "start-server-webpack-plugin";

export default {
  // This script will be ran after building
  entry: {
    ...
  },
  ...
  plugins: [
    ...
    // Only use this in DEVELOPMENT
    new StartServerPlugin(),
    ...
  ],
  ...
}
```

> **Protip:** You may consider using [`webpack-config-utils`](http://npm.im/webpack-config-utils) to use this only in development:

```javascript
import StartServerPlugin from "start-server-webpack-plugin";
import {getIfUtils, removeEmpty} from "webpack-config-utils";

// utilizing the webpack 2 function API: `webpack --env.dev`
export default env => {
  const {ifDev} = getIfUtils(env)
  
  return {
    // ...
    plugins: removeEmpty([
      ifDev(new StartServerPlugin())
    ]),
  }
};
```

### License

> MIT License 2016 © Eric Clemmons
