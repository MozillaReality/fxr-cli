const path = require('path');

const createTestCafe = require('testcafe');
const getPort = require('get-port');
const internalIp = require('internal-ip');
const URL = require('url').URL;

const commands = require('../../commands/index.js');
const SETTINGS = require('../../lib/settings.js').settings;
const utils = require('../../lib/utils.js');

const MAX_ATTEMPTS = 3;  // Number of times to attempt to connect to the device.
const RETRY_DELAY = 3000;  // Time to delay between attempts in milliseconds (default: 3 seconds).
const RETRY = true;
// const STARTED_TIMEOUT = 12000;  // Time to wait until we time out because of a possible WiFi connection issue in the headset (default: 12 seconds).
const STARTED_TIMEOUT = -1;
const PAGE_LOAD_TIMEOUT = 12000;
const SKIP_JS_ERRORS = true;
const TEST_SRC = path.join(__dirname, 'test.js');

async function run () {
  const hostname = await internalIp.v4();
  const port = await getPort({port: 9000});
  const portSecond = await getPort({port: port + 1});

  let runner = null;
  let testcafe = null;

  createTestCafe(hostname, port, portSecond)
    .then(tc => {
      testcafe = tc;
      runner = testcafe.createRunner();
      return testcafe.createBrowserConnection();
    })
    .then(async (remoteConnection) => {
      const ngrok = require('ngrok');
      const ngrokHost = await ngrok.connect({
        addr: port,
        subdomain: SETTINGS.ngrok.subdomain,
        authtoken: SETTINGS.ngrok.authtoken
      });
      const connectionPathname = new URL(remoteConnection.url).pathname;
      const ngrokUrl = `${ngrokHost}${connectionPathname}`;
      console.log(`remote URL: ${remoteConnection.url}`);
      console.log(`ngrok URL: ${ngrokUrl}`);
      const launch = () => commands.launch.run({url: ngrokUrl});
      let connectionStarted = false;
      let numAttempts = 0;
      let timeoutStarted = null;

      remoteConnection.once('ready', () => {
        connectionStarted = true;
        clearTimeout(timeoutStarted);

        const taskPromise = runner
          .src(TEST_SRC)
          .browsers(remoteConnection)
          .run({
            skipJsErrors: SKIP_JS_ERRORS,
            pageLoadTimeout: PAGE_LOAD_TIMEOUT
          })
          // .reporter('json')
          .then(failedCount => {
            testcafe.close();
            process.exit(failedCount ? 1 : 0);
          })
          .catch(err => {
            taskPromise.cancel();
            console.error(err);
            process.exit(1);
          });
      });

      launch().then(launched => {
        if (launched && launched.length) {
          // console.log('Launched testing entry-point URL');
          if (STARTED_TIMEOUT >= 0) {
            timeoutStarted = setTimeout(() => {
              if (connectionStarted) {
                clearTimeout(timeoutStarted);
                return;
              }
              console.error(`URL could not be loaded on the device; in the headset, ensure that your WiFi is properly set up`);
              process.exit(1);
            }, STARTED_TIMEOUT);
          }
        } else {
          // console.error('Could not load testing entry-point URL');
        }
      }).catch(err => {
        if (RETRY && RETRY_DELAY >= 0) {
          if (err.message === 'Could not find connected device') {
            if (numAttempts >= MAX_ATTEMPTS) {
              console.error(`Could not load testing entry-point URL:\n Error: ${err.message}`);
              process.exit(1);
            }
            numAttempts++;
            setTimeout(() => {
              if (numAttempts >= MAX_ATTEMPTS) {
                return;
              }
              launch();
            }, RETRY_DELAY);
            return;
          }
        }
        console.error('Could not load testing entry-point URL:\n', err);
      });
    });
}

if (module.parent) {
  module.exports = run;
} else {
  run();
}
