const http = require('http');
const path = require('path');

const androidPlatformTools = require('android-platform-tools');
const fs = require('fs-extra');
const getPort = require('get-port');
const shell = require('shelljs');

const SETTINGS = require('./settings.js').settings;

const PLATFORMS = SETTINGS.platforms;
const PLATFORMS_SLUGS = SETTINGS.platformsSlugs;

const adb = path.join(__dirname, '..', 'node_modules', '.bin', 'adbn');
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

module.exports.requireAdb = (forceUpdate = adbFirstTime) => {
  if (forceUpdate) {
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

module.exports.getPlatform = str => {
  const strWithPlatformMaybe = (str || '').toLowerCase();
  if (strWithPlatformMaybe) {
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

module.exports.ngrok = (port = SETTINGS.ngrok.port) => {
  return getPort({port}).then(portAvailable => {
    return new Promise((resolve, reject) => {
      if (SETTINGS.ngrok && SETTINGS.ngrok.enabled) {
        const ngrok = require('ngrok');
        const server = http.createServer((req, res) => {
          console.log('req.url', req.url);
          if (req.url === '/') {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end('ok');
          }
        }).listen(portAvailable, () => {
          ngrok.connect(
            {
              addr: portAvailable,
              subdomain: SETTINGS.ngrok.subdomain,
              authtoken: SETTINGS.ngrok.authtoken
            },
            (err, url) => {
              if (err) {
                if (err.code === 'ECONNREFUSED') {
                  reject(new Error(`Connection refused at ${err.address}:${err.port}`));
                } else {
                  reject(err);
                }
              } else {
                resolve(url);
              }
            }
          );
        });
      } else {
        reject(new Error('ngrok is disabled'));
      }
    });
  }, portErr => {
    return Promise.reject(new Error('Could not find an available port at which to spawn the local server'));
  });
};
