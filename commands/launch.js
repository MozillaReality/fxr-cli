const child_process = require('child_process');
const path = require('path');

const logger = require('loggy');
logger.notificationsTitle = 'fxr';
const shell = require('shelljs');

const pkgJson = require('../package.json');
const SETTINGS = require('../lib/settings.js').settings;
const utils = require('../lib/utils.js');

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
    url: options.url,
    verbose: options.verbose
  }, options);

  const silent = !options.verbose;

  const stdio = silent ? 'ignore' : 'inherit';

  let result = utils.requireAdb(options.forceUpdate).then(adb => {
    return options.platformsSlugs.map(platform => {
      const loggerPlatform = (str, level) => utils.loggerPlatform(platform, str, level);

      // TODO: Check if the platform's APK is first installed on the device.
      const dirPlatform = path.resolve(PATHS.downloads, platform);
      const pathApk = shell.find(path.join(dirPlatform, '*.apk'));
      if (!pathApk) {
        throw new Error(`Could not find APK for platform "${platform}"`);
      }

      const devices = shell.exec(`${adb} devices`, {silent});
      if (devices.stdout === 'List of devices attached\n\n') {
        loggerPlatform(`Put on your VR headset`);
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
        cmd = child_process.execFileSync(adb, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', options.url, 'org.mozilla.vrbrowser/org.mozilla.vrbrowser.VRBrowserActivity'], {stdio});
      } else {
        cmd = child_process.execFileSync(adb, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', 'org.mozilla.vrbrowser/org.mozilla.vrbrowser.VRBrowserActivity'], {stdio});
      }

      let errMsg;
      if (cmd.stderr.startsWith('Error')) {
        errMsg = `Could not launch ${options.url ? options.url : pkgJson.productName}`;
        loggerPlatform(errMsg, 'error');
        throw new Error(errMsg);
      } else {
        loggerPlatform(`Launched ${options.url ? options.url : pkgJson.productName}`, 'success');
      }

      // TODO: Return a Promise.
      return platform;
    });
  });

  result.abort = setForceAbort;

  return result;
}

launch.abort = setForceAbort;

module.exports.run = launch;
