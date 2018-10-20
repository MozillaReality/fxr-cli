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

function install (options = {}, attempts = 0, downloaded = false) {
  let timeoutRetry = null;
  let hasDownloaded = false;
  const reset = () => {
    clearTimeout(timeoutRetry);
    attempts = 0;
  };

  options = Object.assign({}, {
    platformsSlugs: options.platformsSlugs || [SETTINGS.platform_default],
    forceUpdate: options.forceUpdate,
    forceUpdateAdb: options.forceUpdateAdb,
    url: options.url
  }, options);
  options.forceUpdate = downloaded !== true; // TODO: Do not download if we already have the latest builds: https://github.com/MozillaReality/fxr-cli/issues/21
  const silent = !options.verbose;

  return new Promise(async (resolve, reject) => {
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
    if (options.forceUpdate || !apkLocalPath || !fs.existsSync(apkLocalPath)) {
      loggerPlatform('Downloading', 'log');
      hasDownloaded = true;
      return download.run(options)
        .then(async () => {
          try {
            downloadsMetadata = await fs.readJson(PATHS.downloads_index);
          } catch (err) {
          }
          if (downloadsMetadata) {
            taskId = downloadsMetadata.taskId;
            apkArtifact = downloadsMetadata.artifacts.find(p => p.platform && p.platform.slug === platform);
            if (apkArtifact) {
              apkTimestamp = (apkArtifact.downloaded || new Date().toJSON()).split('T')[0];
              apkLocalPath = path.resolve(PATHS.downloads, platform, apkArtifact.basename);
            }
          }
          return install(options, attempts, true);
        });
    }

    const devices = shell.exec(`${adb} devices`, {silent});
    const devicesEmpty = utils.isAdbDevicesListEmpty(devices.stdout);
    if (devices.stderr || !devices.stdout || devicesEmpty) {
      if (devicesEmpty) {
        loggerPlatform(utils.getDeveloperModeTip(platform), 'tip');
      }
      shell.exec(`${adb} shell input keyevent 26`, {silent});
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
        errMsg = `Could not update ${launchedObjStr}`;
      }
      loggerPlatform(errMsg, 'error');
      reject(new Error(errMsg));
    } else {
      let actionStr = 'Updated';
      if (freshInstall) {
        actionStr = 'Installed';
      }
      loggerPlatform(`${actionStr} ${launchedObjStr}${versionStr}`, 'success');
      resolve({
        platform,
        downloaded: hasDownloaded,
        installed: true,
        updated: !freshInstall
      });
    }
  }).catch(err => {
    throw err;
  });
}

module.exports.run = install;
