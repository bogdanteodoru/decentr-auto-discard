const { CheckerPlugin } = require('awesome-typescript-loader');
const { join } = require('path');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    db: join(__dirname, 'src/db.js'),
    'das-db': join(__dirname, 'src/das-db.ts'),
    'das-storage': join(__dirname, 'src/das-storage.ts'),
    'das-events': join(__dirname, 'src/das-events.ts'),
  },
  output: {
    path: join(__dirname, '../angular/dist'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.ts?$/,
        use: 'awesome-typescript-loader?{configFileName: "chrome/tsconfig.json"}'
      }
    ]
  },
  plugins: [new CheckerPlugin()],
  resolve: {
    extensions: ['.ts']
  }
};
