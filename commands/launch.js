const path = require('path');

const logger = require('loggy');
const shell = require('shelljs');

const SETTINGS = require('../lib/settings.js').settings;
const utils = require('../lib/utils.js');

const MAX_ATTEMPTS = 10;  // Number of times to attempt to connect to the device.
const PATHS = SETTINGS.paths;
const RETRY_DELAY = 3000;  // Time to delay between attempts in milliseconds (default: 3 seconds).
const RETRY = true;

function launch (options = {}, attempts = 0) {
  options = Object.assign({}, {
    platformsSlugs: options.platformsSlugs || [SETTINGS.platform_default],
    forceUpdate: options.forceUpdate,
    url: options.url,
    verbose: options.verbose,
    indent: options.indent
  }, options);
  options.indent = utils.getIndent(options.indent);
  const SHOW_STDOUT = options.verbose;
  let attemptTimeout = null;
  return utils.requireAdb(options.forceUpdate).then(adb => {
    return options.platformsSlugs.map(platform => {
      // TODO: Check if the platform's APK is first installed on the device.
      const dirPlatform = path.resolve(PATHS.downloads, platform);
      const pathApk = shell.find(path.join(dirPlatform, '*.apk'));
      if (!pathApk) {
        throw new Error(`Could not find APK for platform "${platform}"`);
      }

      const devices = shell.exec(`${adb} devices`, {silent: !SHOW_STDOUT});
      if (devices.stdout === 'List of devices attached\n\n') {
        logger.log(`${options.indent}Put on your VR headset`);
        if (!RETRY || RETRY_DELAY <= 0) {
          throw new Error('Could not find connected device');
        }
        attemptTimeout = setTimeout(() => {
          if (attempts >= MAX_ATTEMPTS) {
            clearTimeout(attemptTimeout);
            attempts = 0;
            throw new Error('Could not find connected device');
          }
          attempts++;
          shell.exec(`${adb} kill-server`, {silent: !SHOW_STDOUT});
          shell.exec(`${adb} start-server`, {silent: !SHOW_STDOUT});
          launch(options, attempts);
        }, RETRY_DELAY);
      } else {
        clearTimeout(attemptTimeout);
        attempts = 0;
      }

      if (options.url) {
        logger.log(`${options.indent}Launching ${options.url} …`);
        shell.exec(`${adb} shell am start -a android.intent.action.VIEW -d "${options.url}" org.mozilla.vrbrowser/.VRBrowserActivity`, {silent: !SHOW_STDOUT});
      } else {
        logger.log(`${options.indent}Launching …`);
        shell.exec(`${adb} shell am start -n org.mozilla.vrbrowser/.VRBrowserActivity`, {silent: !SHOW_STDOUT});
      }

      // TODO: Return a Promise.
      return platform;
    });
  });
}

module.exports.run = launch;
