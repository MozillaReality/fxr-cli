const path = require('path');

const logger = require('loggy');
const shell = require('shelljs');

const SETTINGS = require('../lib/settings.js').settings;
const utils = require('../lib/utils.js');

function install (options) {
  options = Object.assign({}, {
    platformsSlugs: options.platformsSlugs || [SETTINGS.platform_default],
    forceUpdate: options.forceUpdate,
    url: options.url
  }, options);
  return utils.requireAdb(options.forceUpdate).then(adb => {
    return options.platformsSlugs.map(platform => {
      // TODO: Check if most recent version of the platform's APK is already installed on the device.
      const dirPlatform = path.join(__dirname, '..', 'downloads', platform);
      const pathApk = shell.find(path.join(dirPlatform, '*.apk'));
      if (!pathApk) {
        throw new Error(`Could not find APK for platform "${platform}"`);
      }

      const devices = shell.exec(`${adb} devices`, {silent: true});
      if (devices.stdout === 'List of devices attached\n\n') {
        throw new Error('Could not find connected device');
      }

      logger.log('\tPut your finger in front of the proximity sensor the Oculus Go');

      shell.exec(`${adb} uninstall org.mozilla.vrbrowser`, {silent: true});
      shell.exec(`${adb} install -r ${pathApk}`, {silent: true});

      if (options.url) {
        shell.exec(`${adb} shell am start -a android.intent.action.VIEW -d "${options.url}" org.mozilla.vrbrowser/.VRBrowserActivity`, {silent: true});
      } else {
        logger.log('\tRun `fxr launch http://example.com/` to launch Firefox Reality');
      }

      return platform;
    });
  });
}

module.exports.run = install;
