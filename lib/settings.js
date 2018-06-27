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

SETTINGS.test_port = SETTINGS.test_port ? parseInt(SETTINGS.test_port, 10) : SETTINGS.port;
SETTINGS.test_reporter = ['list', 'json', 'html'].includes(SETTINGS.test_reporter) ? SETTINGS.test_reporter : 'list';

module.exports.settings = SETTINGS;
