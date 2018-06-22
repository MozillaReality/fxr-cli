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

module.exports.settings = SETTINGS;
