'use strict';

const path = require('path');

const chalk = require('chalk');
const fs = require('fs-extra');
const shell = require('shelljs');

const pkgJson = require('../package.json');
const SETTINGS = require('../lib/settings.js').settings;
const utils = require('../lib/utils.js');

const LIBRARY_NAME = pkgJson.libraryName || (pkgJson.bin && Object.keys(pkgJson.bin)[0]);
const MAX_ATTEMPTS = 10; // Number of times to attempt to connect to the device.
const PATHS = SETTINGS.paths;
const REPORT_DELIMETER = '\t';
const REPORT_HEADER_ROW = ['url', 'works', 'notes', 'date_reported'];
const REPORT_PATH = path.join(__dirname, '..', 'report.csv');
const REPORT_QUEUE_PATH = path.join(__dirname, '..', 'queue.csv');
const RETRY_DELAY = 3000; // Time to delay between attempts in milliseconds (default: 3 seconds).
const RETRY = true; // Whether to attempt to retry the launch.

let urlsToTest = [];
const updateUrlsToTest = () => {
  try {
    const urlsToTestStr = fs.readFileSync(REPORT_QUEUE_PATH);
    urlsToTest = urlsToTestStr.toString().trim().replace(/^url.*/i, '').trim().split('\n').map(line => line.trim());
  } catch (err) {
  }
};
let forceAbort = false;
const setForceAbort = () => {
  forceAbort = true;
};

updateUrlsToTest();

function launch (options = {}, attempts = 0, abort = false) {
  let timeoutRetry = null;
  const reset = () => {
    clearTimeout(timeoutRetry);
    attempts = 0;
  };

  if (forceAbort) {
    abort = true;
  }

  if (abort) {
    reset();
    return;
  }

  options = Object.assign({}, {
    platformsSlugs: options.platformsSlugs || [SETTINGS.platform_default],
    forceUpdate: options.forceUpdate,
    forceUpdateAdb: options.forceUpdateAdb,
    url: options.url,
    verbose: options.verbose
  }, options);

  const silent = !options.verbose;

  let result = new Promise(async (resolve, reject) => {
    let adb = null;
    try {
      adb = await utils.requireAdb(options.forceUpdateAdb);
    } catch (err) {
      throw err;
    }

    const platform = options.platformsSlugs[0];
    const loggerPlatform = (str, level) => utils.loggerPlatform(platform, str, level);

    let downloadsMetadata = null;
    let apkArtifact;
    let apkLocalPath;
    try {
      downloadsMetadata = await fs.readJson(PATHS.downloads_index);
    } catch (err) {
      throw err;
    }
    if (downloadsMetadata) {
      apkArtifact = downloadsMetadata.artifacts.find(p => p.platform && p.platform.slug === platform);
      if (apkArtifact) {
        apkLocalPath = path.resolve(PATHS.downloads, platform, apkArtifact.basename);
      }
    }

    // TODO: Check if the platform's APK is first installed on the device.
    if (!apkLocalPath || !fs.existsSync(apkLocalPath)) {
      // TODO: Run `download` + `install` if needed: https://github.com/MozillaReality/fxr-cli/issues/28
      reject(new Error(`${chalk.bold(pkgJson.productName)} is not installed`));
      loggerPlatform(`First run ${chalk.bold.green.bgBlack(`${LIBRARY_NAME} install`)} to install ${chalk.bold(pkgJson.productName)}`, 'tip');
      return;
    }

    const devices = shell.exec(`${adb} devices`, {silent});
    if (devices.stderr || !devices.stdout || devices.stdout === 'List of devices attached\n\n') {
      if (devices.stdout === 'List of devices attached\n\n') {
        loggerPlatform(utils.getDeveloperModeTip(platform), 'tip');
      }
      loggerPlatform('Put on your VR headset', 'warn');
      if (!RETRY || RETRY_DELAY <= 0) {
        throw new Error('Could not find connected device');
      }
      timeoutRetry = setTimeout(() => {
        if (attempts >= MAX_ATTEMPTS) {
          reset();
          throw new Error('Could not find connected device');
        }
        attempts++;
        shell.exec(`${adb} kill-server`, {silent});
        shell.exec(`${adb} start-server`, {silent});
        launch(options, attempts, abort);
      }, RETRY_DELAY);
    } else {
      reset();
    }

    if (options.test) {
      let result = [];
      for (let idx = 0; idx < urlsToTest.length; idx++) {
        try {
          updateUrlsToTest();
          result.push(await launchUrl({url: urlsToTest[idx], test: true}));
        } catch (err) {
          reject(err);
        }
      }
      resolve(result);
    } else {
      resolve(launchUrl({url: options.url}));
    }

    function launchUrl (opts) {
      return new Promise((resolve, reject) => {
        opts = typeof opts === 'string' ? {url: opts} : opts || {};
        let cmd;
        if (opts.url) {
          cmd = shell.exec(`${adb} shell am start -a android.intent.action.VIEW -d "${opts.url}" org.mozilla.vrbrowser/org.mozilla.vrbrowser.VRBrowserActivity`, {silent});
        } else {
          cmd = shell.exec(`${adb} shell am start -a android.intent.action.VIEW org.mozilla.vrbrowser/org.mozilla.vrbrowser.VRBrowserActivity`, {silent});
        }
        let errMsg;
        let launchedObjStr = opts.url ? chalk.bold.underline(opts.url) : chalk.bold(pkgJson.productName);
        if (cmd.stderr && cmd.stderr.startsWith('Error')) {
          errMsg = `Could not launch ${launchedObjStr}`;
          loggerPlatform(errMsg, 'error');
          return reject(errMsg);
        }

        loggerPlatform(`Launched ${launchedObjStr}`, 'success');

        if (opts.test) {
          const readline = require('readline');

          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          return fs.exists(REPORT_PATH).then(exists => {
            if (exists) {
              return prompt();
            }
            return fs.writeFile(REPORT_PATH, `${REPORT_HEADER_ROW.join(REPORT_DELIMETER)}\n`)
              .then(prompt);
          });

          function prompt () {
            return new Promise((resolvePrompt, rejectPrompt) => {
              rl.question(`${chalk.green('GOOD')} or ${chalk.red('BAD')}? `, answer => {
                answer = answer.trim().toLowerCase();
                const passed = answer.includes('p') || answer.includes('y') || answer.includes('g');
                console.log(passed ? chalk.bold.black.bgGreen('PASS') : chalk.bold.black.bgRed('FAIL'), opts.url);
                const row = [opts.url || '', passed ? 'yes' : 'no', '', new Date().toJSON()];
                fs.appendFile(REPORT_PATH, `${row.join(REPORT_DELIMETER)}\n`).then(() => {
                  resolvePrompt({
                    url: row[0],
                    passed: row[1],
                    notes: row[2],
                    date_reported: row[3]
                  });
                  rl.close();
                }).catch(err => {
                  console.warn(err);
                  rejectPrompt(err);
                  rl.close();
                });
              });
            }).then(() => {
              resolve({
                url: opts.url,
                platform
              });
            });
          }
        } else {
          resolve({
            url: opts.url,
            platform
          });
        }
      });
    }
  });

  result.abort = setForceAbort;

  return result;
}

launch.abort = setForceAbort;

module.exports.run = launch;
