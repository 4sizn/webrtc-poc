const webpack = require('webpack')
const path = require('path')
const env = require('./utils/env')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const WriteFilePlugin = require('write-file-webpack-plugin')

// load the secrets
var alias = {}

// var fileExtensions = ['jpg', 'jpeg', 'png', 'gif', 'eot', 'otf', 'svg', 'ttf', 'woff', 'woff2']

var options = {
  entry: {
    // client: path.join(__dirname, 'src', 'js', 'main.js')
    client: path.join(__dirname, 'src', 'js', 'example_client.js')

  },
  output: {
    path: path.join(__dirname, 'build'),
    filename: '[name].js'
  },
  resolve: {
    alias: alias
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        loader: 'style-loader!css-loader',
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    // clean the build folder
    new CleanWebpackPlugin(['build']),
    // expose and write the allowed env vars on the compiled bundle
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV),
      'process.env.PORT': JSON.stringify(env.PORT)
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'client.html'),
      filename: 'client.html',
      chunks: ['client']
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'host.html'),
      filename: 'host.html',
      chunks: ['host']
    }),
    new WriteFilePlugin()
  ],
  performance: {
    hints: process.env.NODE_ENV === 'production' ? "warning" : false
  }
}

if (env.NODE_ENV === 'development') {
  options.devtool = 'inline-source-map'
}

module.exports = options
