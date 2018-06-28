const path = require('path');

const createTestCafe = require('testcafe');
const getPort = require('get-port');
const internalIp = require('internal-ip');
const logger = require('loggy');
const URL = require('url').URL;

const launch = require('../../commands/launch.js');
const parseOptions = require('../../lib/parseCli.js').parseOptions;
const SETTINGS = require('../../lib/settings.js').settings;
const utils = require('../../lib/utils.js');

const STARTED_TIMEOUT = 60000;  // Time to wait until we time out because of a possible WiFi connection issue in the headset (default: 60 seconds).
// const STARTED_TIMEOUT = -1;
const PAGE_LOAD_TIMEOUT = 12000;
const SKIP_JS_ERRORS = true;
const TEST_SRC = path.join(__dirname, 'test.js');

const run = async (options = {}) => {
  options = Object.assign({}, parseOptions('test'));

  const hostname = await internalIp.v4();
  const port = await getPort({port: options.port});
  let runner = null;
  let testcafe = null;

  const portSecond = await getPort({port: port + 1});

  createTestCafe(hostname, port, portSecond)
    .then(tc => {
      testcafe = tc;
      runner = testcafe.createRunner();
      return testcafe.createBrowserConnection();
    })
    .then(async (remoteConnection) => {
      const launchOptions = Object.assign({}, options, {
        url: remoteConnection.url,
        indent: 0
      });
      let connectionStarted = false;
      let timeoutStarted = null;

      const launchTests = (abort = false) => launch.run(launchOptions, 0, abort);
      const reset = () => {
        clearTimeout(timeoutStarted);
      };

      remoteConnection.once('ready', () => {
        connectionStarted = true;
        reset();

        runner
          .src(TEST_SRC)
          .browsers(remoteConnection)
          .reporter(launchOptions.reporter)
          .run({
            skipJsErrors: SKIP_JS_ERRORS,
            pageLoadTimeout: PAGE_LOAD_TIMEOUT,
            debugMode: true
          })
          .then(failedCount => {
            testcafe.close();
            process.exit(failedCount ? 1 : 0);
          })
          .catch(err => {
            console.error(err);
            process.exit(1);
          });
      });

      function displayError (err, exitCode) {
        if (err) {
          logger.error(`${launchOptions.indent}Could not load testing entry-point URL "${launchOptions.url}":\n Error: ${err.message}`);
        } else {
          logger.error(`${launchOptions.indent}Could not load testing entry-point URL "${launchOptions.url}"`);
        }
        if (typeof exitCode !== 'undefined') {
          process.exit(exitCode);
        }
      }

      launchTests().then(launched => {
        if (launched && (launched === true || launched.length)) {
          if (STARTED_TIMEOUT >= 0) {
            timeoutStarted = setTimeout(() => {
              if (connectionStarted) {
                reset();
                return;
              }
              logger.log(`${launchOptions.indent}Ensure that your device and its WiFi are properly set up`);
            }, STARTED_TIMEOUT);
          }
        }
      }).catch(err => {
        displayError(err, 1);
      });
    });
};

if (module.parent) {
  module.exports = run;
} else {
  run();
}
