const WebpackDevServer = require('webpack-dev-server')
const webpack = require('webpack')
const config = require('../webpack.config')
const env = require('./env')
const path = require('path')

// var fs = require('fs-extra')

var options = (config.chromeExtensionBoilerplate || {})
var excludeEntriesToHotReload = (options.notHotReload || [])

for (var entryName in config.entry) {
  if (excludeEntriesToHotReload.indexOf(entryName) === -1) {
    config.entry[entryName] =
      [
        ('webpack-dev-server/client?http://localhost:' + env.PORT),
        'webpack/hot/dev-server'
      ].concat(config.entry[entryName])
  }
}

config.plugins =
  [new webpack.HotModuleReplacementPlugin()].concat(config.plugins || [])

delete config.chromeExtensionBoilerplate

var compiler = webpack(config)

var server =
  new WebpackDevServer(compiler, {
    hot: true,
    contentBase: path.join(__dirname, '../build'),
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    }
  })

server.listen(env.PORT)
