const path = require('path');

const createTestCafe = require('testcafe');
const getPort = require('get-port');
const internalIp = require('internal-ip');
const logger = require('loggy');

const launch = require('../../commands/launch.js');
const parseOptions = require('../../lib/parseCli.js').parseOptions;

const STARTED_TIMEOUT = 60000; // Time to wait until we time out because of a possible WiFi connection issue in the headset (default: 60 seconds; disable: -1).
const TEST_SRC = path.join(__dirname, 'test.js');
const TESTCAFE_OPTIONS = {
  debugMode: true,
  pageLoadTimeout: 12000, // Time to wait until the test runner marks a site as `FAIL` (default: 12 seconds).
  skipJsErrors: true
};

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
        url: remoteConnection.url
      });
      let connectionStarted = false;
      let timeoutStarted = null;
      let launchedTests = null;

      const launchTests = (abort = false) => {
        return launch.run(launchOptions, 0, abort);
      };
      const reset = () => {
        if (launchedTests && launchedTests.abort) {
          launchedTests.abort();
        }
        clearTimeout(timeoutStarted);
      };

      remoteConnection.once('ready', () => {
        connectionStarted = true;
        reset();

        runner
          .src(TEST_SRC)
          .browsers(remoteConnection)
          .reporter(launchOptions.reporter)
          .run(TESTCAFE_OPTIONS)
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

      launchedTests = launchTests();
      launchedTests.then(launched => {
        if (connectionStarted) {
          reset();
          return;
        }
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
