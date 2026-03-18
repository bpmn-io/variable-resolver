const coverage = process.env.COVERAGE;
const singleStart = process.env.SINGLE_START;
process.env.CHROME_BIN = require('puppeteer').executablePath();
const suite = coverage ? 'test/coverageBundle.js' : 'test/testBundle.js';

module.exports = function(karma) {
  karma.set({
    frameworks: ['mocha', 'webpack'],
    files: [suite],
    preprocessors: { [suite]: ['webpack', 'env'] },
    reporters: ['progress'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    },
    browsers: ['ChromeHeadlessNoSandbox'],
    autoWatch: false,
    singleRun: true,
    webpack: {
      mode: 'development',
      resolve: { modules: ['node_modules', __dirname] },
      module: {
        rules: [
          { test: /\.css|\.bpmn$/, type: 'asset/source' },
          { test: require.resolve('./test/globals.js'), sideEffects: true },
          { test: /\.json$/, type: 'json' }
        ]
      },
      devtool: 'eval-source-map'
    }
  });
};
