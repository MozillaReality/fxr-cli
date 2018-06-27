const path = require('path');

const createTestCafe = require('testcafe');
const getPort = require('get-port');
const internalIp = require('internal-ip');
const logger = require('loggy');
const URL = require('url').URL;

const commands = require('../../commands/index.js');
const SETTINGS = require('../../lib/settings.js').settings;
const utils = require('../../lib/utils.js');

const MAX_ATTEMPTS = 3;  // Number of times to attempt to connect to the device.
const RETRY_DELAY = 3000;  // Time to delay between attempts in milliseconds (default: 3 seconds).
const RETRY = true;
const STARTED_TIMEOUT = 60000;  // Time to wait until we time out because of a possible WiFi connection issue in the headset (default: 60 seconds).
// const STARTED_TIMEOUT = -1;
const PAGE_LOAD_TIMEOUT = 12000;
const SKIP_JS_ERRORS = true;
const TEST_SRC = path.join(__dirname, 'test.js');

async function run (options = {}) {
  options = Object.assign({}, {
    platformsSlugs: options.platformsSlugs || [SETTINGS.platform_default],
    forceUpdate: options.forceUpdate,
    reporter: options.reporter || 'list'
  }, options);

  const hostname = await internalIp.v4();
  const port = await getPort({port: 9000});
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
      const launchOptions = Object.assign({}, options, {url: remoteConnection.url});
      let attemptRetry = RETRY && RETRY_DELAY >= 0;
      let connectionStarted = false;
      let numAttempts = 0;
      let timeoutStarted = null;
      let timeoutRetry = null;

      const launch = () => commands.launch.run(launchOptions);

      const clearTimeouts = () => {
        clearTimeout(timeoutStarted);
        clearTimeout(timeoutRetry);
      };

      remoteConnection.once('ready', () => {
        connectionStarted = true;
        clearTimeouts();

        runner
          .src(TEST_SRC)
          .browsers(remoteConnection)
          .reporter(options.reporter)
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
          logger.error(`\t\tCould not load testing entry-point URL "${launchOptions.url}":\n Error: ${err.message}`);
        } else {
          logger.error(`\t\tCould not load testing entry-point URL "${launchOptions.url}"`);
        }
        if (typeof exitCode !== 'undefined') {
          process.exit(exitCode);
        }
      }

      function retryLaunch (err) {
        if (connectionStarted) {
          return clearTimeouts();
        }
        if (!attemptRetry) {
          return displayError(err, 1);
        }
        attemptRetry = !err || err.message === 'Could not find connected device';
        if (attemptRetry && numAttempts < MAX_ATTEMPTS) {
          numAttempts++;
          timeoutRetry = setTimeout(() => {
            if (numAttempts >= MAX_ATTEMPTS) {
              return clearTimeouts();
            }
            launch();
          }, RETRY_DELAY);
        }
        if (numAttempts >= MAX_ATTEMPTS) {
          return displayError(err, 1);
        }
      }

      launch().then(launched => {
        retryLaunch();
        if (launched && (launched === true || launched.length)) {
          if (STARTED_TIMEOUT >= 0) {
            timeoutStarted = setTimeout(() => {
              if (connectionStarted) {
                clearTimeout(timeoutStarted);
                return;
              }
              logger.log(`\t\tEnsure that your device and its WiFi are properly set up`);
            }, STARTED_TIMEOUT);
          }
        }
      }).catch(err => {
        retryLaunch(err);
        displayError(err);
      });
    });
}

if (module.parent) {
  module.exports = run;
} else {
  run();
}
