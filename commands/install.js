const path = require('path');

const chalk = require('chalk');
const fs = require('fs-extra');
const logger = require('loggy');
const shell = require('shelljs');

const pkgJson = require('../package.json');
const SETTINGS = require('../lib/settings.js').settings;
const utils = require('../lib/utils.js');
const download = require('./download.js');

const PATHS = SETTINGS.paths;

function install (options = {}, attempts = 0) {
  let timeoutRetry = null;
  const reset = () => {
    clearTimeout(timeoutRetry);
    attempts = 0;
  };

  options = Object.assign({}, {
    platformsSlugs: options.platformsSlugs || [SETTINGS.platform_default],
    forceUpdate: options.forceUpdate,
    url: options.url
  }, options);
  const silent = !options.verbose;

  return new Promise(async (resolve, reject) => {
    const adb = await utils.requireAdb(options.forceUpdate);

    const platform = options.platformsSlugs[0];
    const loggerPlatform = (str, level) => utils.loggerPlatform(platform, str, level);

    let downloadsMetadata = null;
    let taskId;
    let apkArtifact;
    let apkTimestamp;
    let apkLocalPath;
    try {
      downloadsMetadata = await fs.readJson(PATHS.downloads_index);
    } catch (err) {
    }
    if (downloadsMetadata) {
      taskId = downloadsMetadata.taskId;
      apkArtifact = downloadsMetadata.artifacts.find(p => p.platform && p.platform.slug === platform);
      if (apkArtifact) {
        apkTimestamp = apkArtifact.downloaded.split('T')[0];
        apkLocalPath = path.resolve(PATHS.downloads, platform, apkArtifact.basename);
      }
    }

    // TODO: Check if the platform's APK is first installed on the device.
    if (!apkLocalPath || !fs.existsSync(apkLocalPath)) {
      loggerPlatform('Downloading', 'log');
      return download.run(options)
        .then(downloaded => {
          return install(options);
        });
      // throw new Error(`Could not find APK for platform "${platform}"`);
    }

    const devices = shell.exec(`${adb} devices`, {silent});
    if (devices.stderr || !devices.stdout || devices.stdout === 'List of devices attached\n\n') {
      if (devices.stdout === 'List of devices attached\n\n') {
        loggerPlatform(utils.getDeveloperModeTip(platform), 'tip');
      }
      shell.exec(`${adb} shell input keyevent 26`, {silent});
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
        install(options, attempts);
      }, RETRY_DELAY);
    } else {
      reset();
    }

    const freshInstall = shell.exec(`${adb} uninstall org.mozilla.vrbrowser`, {silent}).stderr.includes('Unknown package');
    const cmdInstall = shell.exec(`${adb} install -r ${apkLocalPath}`, {silent});

    const launchedObjStr = chalk.bold(pkgJson.productName);
    const versionStr = apkArtifact ? ` ${chalk.gray(`(${taskId} - ${apkTimestamp})`)}` : '';
    let errMsg;
    if (cmdInstall.stderr && cmdInstall.stderr.startsWith('Error')) {
      if (freshInstall) {
        errMsg = `Could not install ${launchedObjStr}`;
      } else {
        errMsg = `Could not reinstall ${launchedObjStr}`;
      }
      loggerPlatform(errMsg, 'error');
      reject(errMsg);
    } else {
      if (freshInstall) {
        loggerPlatform(`Installed ${launchedObjStr}${versionStr}`, 'success');
      } else {
        loggerPlatform(`Reinstalled ${launchedObjStr}${versionStr}`, 'success');
      }
      resolve({
        platform
      });
    }
  }).catch(err => {
    throw err;
  });
}

module.exports.run = install;
