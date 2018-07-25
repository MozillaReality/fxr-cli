const child_process = require('child_process');
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
const RETRY_DELAY = 3000; // Time to delay between attempts in milliseconds (default: 3 seconds).
const RETRY = true; // Whether to attempt to retry the launch.

let forceAbort = false;
const setForceAbort = () => {
  forceAbort = true;
};

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
    const adb = await utils.requireAdb(options.forceUpdateAdb);

    const platform = options.platformsSlugs[0];
    const loggerPlatform = (str, level) => utils.loggerPlatform(platform, str, level);

    let downloadsMetadata = null;
    let apkArtifact;
    let apkLocalPath;
    try {
      downloadsMetadata = await fs.readJson(PATHS.downloads_index);
    } catch (err) {
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

    let cmd;
    if (options.url) {
      cmd = shell.exec(`${adb} shell am start -a android.intent.action.VIEW -d "${options.url}" org.mozilla.vrbrowser/org.mozilla.vrbrowser.VRBrowserActivity`, {silent});
    } else {
      cmd = shell.exec(`${adb} shell am start -a android.intent.action.VIEW org.mozilla.vrbrowser/org.mozilla.vrbrowser.VRBrowserActivity`, {silent});
    }

    let errMsg;
    let launchedObjStr = options.url ? chalk.bold.underline(options.url) : chalk.bold(pkgJson.productName);
    if (cmd.stderr && cmd.stderr.startsWith('Error')) {
      errMsg = `Could not launch ${launchedObjStr}`;
      loggerPlatform(errMsg, 'error');
      reject(errMsg);
    } else {
      loggerPlatform(`Launched ${launchedObjStr}`, 'success');
      resolve({
        url: options.url,
        platform
      });
    }
  });

  result.abort = setForceAbort;

  return result;
}

launch.abort = setForceAbort;

module.exports.run = launch;
