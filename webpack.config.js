const webpack = require('webpack');
const path = require('path');
const { execSync } = require('child_process');
const decompress = require('decompress');

const SHARP_VERSION = execSync('npm info sharp version')
  .toString()
  .replace('\n', '');

const sharpTarball = path.join(
  __dirname,
  `lambda-sharp/tarballs/sharp-${SHARP_VERSION}-aws-lambda-linux-x64-node-8.10.1.tar.gz`
);
const webpackDir = path.join(__dirname, '.webpack/');

function ExtractTarballPlugin(archive, to) {
  return {
    apply: compiler => {
      compiler.plugin('emit', (compilation, callback) => {
        decompress(path.resolve(archive), path.resolve(to))
          .then(() => callback())
          .catch(error =>
            console.error(
              'Unable to extract archive ',
              archive,
              to,
              error.stack
            )
          );
      });
    },
  };
}

module.exports = {
  entry: './src/handler.js',
  target: 'node',
  output: {
    libraryTarget: 'commonjs',
    path: path.resolve(__dirname, '.webpack'),
    filename: 'handler.js', // this should match the first part of function handler in serverless.yml
  },
  externals: ['sharp', 'aws-sdk'],
  plugins: [
    new ExtractTarballPlugin(sharpTarball, webpackDir),
    new webpack.IgnorePlugin(/vertx/),
  ],
};
