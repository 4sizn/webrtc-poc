const webpack = require('webpack')
const path = require('path')
const env = require('./utils/env')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const WriteFilePlugin = require('write-file-webpack-plugin')

// load the secrets
var alias = {}

var fileExtensions = ['jpg', 'jpeg', 'png', 'gif', 'eot', 'otf', 'svg', 'ttf', 'woff', 'woff2']

var options = {
  mode: 'development',
  entry: {
    client: path.join(__dirname, 'src', 'js', 'client.js'),
    host: path.join(__dirname, 'src', 'js', 'host.js')
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
      },
      {
        test: new RegExp('\.(' + fileExtensions.join('|') + ')$'),
        loader: 'file-loader?name=[name].[ext]',
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
      'process.env.PORT': JSON.stringify(env.PORT),
      'process.env.PRODUCTION_URL': JSON.stringify(env.PRODUCTION_URL)
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
  optimization: {
    minimize : false
  },
  performance: {
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false
  }
}

if (env.NODE_ENV === 'development') {
  options.devtool = 'inline-source-map'
}

module.exports = options
