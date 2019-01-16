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
const REPORT_HEADER_ROW = ['url', 'works', 'notes', 'platform', 'date_reported'];
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

class Screenshots {
  constructor ({adb, silent, pathOutput}) {
    this.adb = adb;
    this.silent = silent;
    this.pathOutput = utils.forceTrailingSlash(pathOutput ||
                                               process.env.FXR_SCREENSHOTS_PATH ||
                                               process.env.SCREENSHOTS_PATH ||
                                               path.join(process.cwd(), 'fxr-screenshots'));
  }

  get interval () {
    return parseInt(process.env.FXR_SCREENSHOTS_INTERVAL || process.env.SCREENSHOTS_INTERVAL || '2000', 10);
  }

  capture () {
    return shell.exec(`${this.adb} exec-out screencap -p > ${this.pathOutput}$(date +%F_%T).png && say 'screenshot saved'`, {
      silent: this.silent
    });
  }
}

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

  const screenshots = new Screenshots({adb, silent});

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
    const devicesEmpty = utils.isAdbDevicesListEmpty(devices.stdout);
    if (devices.stderr || !devices.stdout || devicesEmpty) {
      if (devicesEmpty) {
        loggerPlatform(utils.getDeveloperModeTip(platform), 'tip');
      }
      loggerPlatform('Put on your VR headset', 'warn');
      if (!RETRY || RETRY_DELAY <= 0) {
        throw new Error('Could not find a connected device');
      }
      timeoutRetry = setTimeout(() => {
        if (attempts >= MAX_ATTEMPTS) {
          reset();
          throw new Error('Could not find a connected device');
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

        let rl;
        const video = (enabled = false) => shell.exec(`${adb} shell setprop debug.oculus.enableVideoCapture ${enabled ? 1 : 0}`, {silent});

        if (opts.test) {
          video(true);

          if (SCREENSHOTS_PATH) {
            setInterval(screenshots.capture, screenshots.interval);
          }

          const readline = require('readline');

          rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          rl.on('SIGINT', function () {
            video(false);
            process.emit('SIGINT'); // This will call `process.exit()` (listener defined in `index.js`).
          });

          return fs.exists(REPORT_PATH).then(exists => {
            if (exists) {
              return prompt();
            }
            return fs.writeFile(REPORT_PATH, `${REPORT_HEADER_ROW.join(REPORT_DELIMETER)}\n`)
              .then(prompt);
          });
        } else {
          resolve({
            url: opts.url,
            platform
          });
        }

        function prompt () {
          return new Promise((resolvePrompt, rejectPrompt) => {
            video(false);

            rl.question(`${chalk.green('GOOD')} or ${chalk.red('BAD')}? `, answer => {
              answer = (answer || '').trim().toLowerCase();

              const passed = answer[0] === 'g' || answer[0] === 'p' || answer[0] === 'y';
              const failed = answer[0] === 'b' || answer[0] === 'f' || answer[0] === 'n';

              const skipped = !passed && !failed;

              console.log(skipped ? chalk.bold.black.bgWhite('SKIP') : (passed ? chalk.bold.black.bgGreen('PASS') : chalk.bold.black.bgRed('FAIL')), opts.url);

              const notes = answer.includes(' ') ? answer.replace(/^.+?\s*[;,.-\/]+(.+)/, '$1').trim() : '';

              const row = [
                opts.url || '',
                passed ? 'yes' : 'no',
                notes,
                platform,
                new Date().toJSON()
              ];

              if (skipped) {
                resolvePrompt({
                  url: row[0],
                  passed: null,
                  notes: row[2],
                  platform: row[3],
                  date_reported: row[4],
                  skipped: true
                });
                rl.close();
                return;
              }

              video(false);

              fs.appendFile(REPORT_PATH, `${row.join(REPORT_DELIMETER)}\n`).then(() => {
                resolvePrompt({
                  url: row[0],
                  passed: row[1],
                  notes: row[2],
                  platform: row[3],
                  date_reported: row[4]
                });
                rl.close();
              }).catch(err => {
                console.warn(err);
                rejectPrompt(err);
                rl.close();
              });
            });
          }).then(() => {
            video(false);
            resolve({
              url: opts.url,
              platform
            });
          }, err => {
            console.warn(err);
            video(false);
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
