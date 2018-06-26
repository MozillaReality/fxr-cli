const path = require('path');

const fs = require('fs-extra');

const PATHS = {};
PATHS.root = path.join(__dirname, '..');
PATHS.settings = path.join(PATHS.root, 'settings.json');
PATHS.downloads = path.join(PATHS.root, 'downloads');
PATHS.downloads_index = path.join(PATHS.downloads, 'index.json');

const SETTINGS_DEFAULT = fs.readJsonSync(PATHS.settings);

const SETTINGS = Object.assign({}, {
  paths: PATHS
}, SETTINGS_DEFAULT);
SETTINGS.platforms = SETTINGS.platforms;
SETTINGS.platformsSlugs = Object.keys(SETTINGS.platforms);
SETTINGS.port = parseInt(SETTINGS.port || '8000', 10);

if (!SETTINGS.ngrok) {
  SETTINGS.ngrok = {enabled: true};
}

if (SETTINGS.ngrok.subdomain) {
  // Strip possible cruft from the supplied ngrok.io subdomain (e.g., 'https://mine.ngrok.io' -> 'mine').
  SETTINGS.ngrok.subdomain = SETTINGS.ngrok.subdomain.replace(/^(https?:|)\/\//i, '').split('.')[0];
}

if (!SETTINGS.ngrok.port) {
  SETTINGS.ngrok.port = SETTINGS.port;
}

module.exports.settings = SETTINGS;
