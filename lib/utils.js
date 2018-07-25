const path = require('path');

const androidPlatformTools = require('android-platform-tools');
const chalk = require('chalk');
const fs = require('fs-extra');
const logger = require('loggy');

const SETTINGS = require('./settings.js').settings;

const PLATFORMS = SETTINGS.platforms;
const PLATFORMS_SLUGS = SETTINGS.platformsSlugs;

let adb = path.join(__dirname, '..', 'node_modules', '.bin', 'adbn');
const adbInstalled = !fs.existsSync(__dirname, 'node_modules', 'android-platform-tools', 'platform-tools', 'adb');

const adbFirstTime = SETTINGS.always_redownload_android_platform_tools === true ? true : adbInstalled;

module.exports.parseOrgRepo = (org, repo) => {
  if (org && !repo) {
    const orgRepoChunks = org.split('/').slice(0, 2);
    if (orgRepoChunks.length) {
      [org, repo] = orgRepoChunks;
    }
  }
  return {org, repo};
};

module.exports.requireAdb = (forceUpdateAdb = adbFirstTime) => {
  if (forceUpdateAdb) {
    return androidPlatformTools.downloadAndReturnToolPaths()
      .then(tools => {
        adb = path.resolve('..', tools.adbPath);
        return adb;
      });
  }
  return Promise.resolve(adb);
};

const isTruthy = module.exports.isTruthy = str => {
  if (!str) {
    return false;
  }
  return str === '1' ||
    str === 'true' ||
    str === 'yes' ||
    str === 'y';
};

module.exports.forceAdb = forceStr => {
  return isTruthy(forceStr) || adbFirstTime;
};

module.exports.getArgvPaths = argv => {
  return (argv || [])
    .filter(arg => fs.existsSync(arg))
    .map(arg => path.resolve(arg));
};

const getPlatform = module.exports.getPlatform = str => {
  const strWithPlatformMaybe = (str || '').toLowerCase();
  if (strWithPlatformMaybe) {
    if (strWithPlatformMaybe.includes('oculus') ||
        strWithPlatformMaybe === 'go') {
      return PLATFORMS.oculusvr;
    }
    if (strWithPlatformMaybe.includes('daydream') ||
        strWithPlatformMaybe.includes('pixel') ||
        strWithPlatformMaybe.includes('google')) {
      return PLATFORMS.googlevr;
    }
    if (strWithPlatformMaybe.includes('wave') ||
        strWithPlatformMaybe.includes('htc')) {
      return PLATFORMS.wavevr;
    }
    if (strWithPlatformMaybe.includes('snap')) {
      return PLATFORMS.svr;
    }
    for (let platform of PLATFORMS_SLUGS) {
      if (strWithPlatformMaybe.includes(platform)) {
        return PLATFORMS[platform];
      }
    }
  }
  return null;
};

module.exports.pluralise = (singular, plural, num = 0) => {
  return num === 1 ? singular : plural;
};

module.exports.uppercaseFirstLetter = str => {
  if (!str) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.substr(1);
};

module.exports.cleanUrl = str => {
  return (str || '').replace(/^["';&]*/g, '').replace(/["';&]*$/g, '').trim();
};

module.exports.getIndent = (num = 0, spaceChar = '\t') => {
  if (!num || !spaceChar) {
    return '';
  }
  if (spaceChar.repeat) {
    return spaceChar.repeat(num);
  }
  let output = '';
  for (let idx = 0; idx < num.length; idx++) {
    output[idx] += spaceChar;
  }
  return output;
};

module.exports.getArgv = (argv = process.argv) => {
  if (!argv) {
    return [];
  }
  argv = argv.slice(0);
  argv.splice(0, 2);
  return argv;
};

module.exports.loggerPlatform = (platform, str, level = 'log') => {
  const isTip = level === 'tip';
  if (isTip) {
    level = 'warn';
  }
  return logger[level](`${chalk.black.bgCyan(getPlatform(platform).name)} ${isTip ? chalk.bold.black.bgYellow('TIP:') + ' ' : ''}${isTip ? chalk.yellow(str) : str}`);
};

module.exports.getDeveloperModeTip = platform => {
  return `Ensure that you have enabled "Developer Mode"` +
    (platform === 'oculusvr' ?
      ` ${chalk.gray(`(${
          chalk.underline('https://developer.oculus.com/documentation/mobilesdk/latest/concepts/mobile-device-setup-go/')
        })`)}` : '');
};
