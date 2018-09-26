#!/usr/bin/env node
process.on('unhandledRejection', err => { throw err; });
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

const path = require('path');

const commandLineCommands = require('command-line-commands');
const commandLineUsage = require('command-line-usage');
const fs = require('fs-extra');
const logger = require('loggy');

process.on('exit', () => process.exit(logger.errorHappened ? 1 : 0));

const commands = require('./commands/index.js');
const parseOptions = require('./lib/parseCli.js').parseOptions;
const pkgJson = require('./package.json');
const SETTINGS = require('./lib/settings.js').settings;
const utils = require('./lib/utils.js');

const pluralise = utils.pluralise;
const uppercaseFirstLetter = utils.uppercaseFirstLetter;

const validCommands = [null, 'download', 'install', 'launch', 'test', 'version', 'help'];

switch (process.argv[2]) {
  case 'fetch':
    process.argv[2] = 'download';
    break;
  case 'update':
  case 'upgrade':
    process.argv[2] = 'install';
    break;
  case 'open':
  case 'run':
  case 'serve':
  case 'server':
  case 'dev':
  case 'url':
    process.argv[2] = 'launch';
    break;
  case 'tests':
  case 't':
    process.argv[2] = 'test';
    break;
}

let parsedCommands = {};

try {
  parsedCommands = commandLineCommands(validCommands);
} catch (err) {
  if (err.name === 'INVALID_COMMAND') {
    help();
    process.exit(1);
  } else {
    throw err;
  }
}

const command = parsedCommands.command;
const argv = parsedCommands.argv;

function version () {
  console.log(pkgJson.version);
  process.exit();
}

function getHeaderLogo () {
  const concat = require('concat-stream');
  const pictureTube = require('picture-tube');
  return new Promise((resolve, reject) => {
    const imgPath = path.join(__dirname, 'assets', 'img', 'ff_logo.png');
    const imgStream = fs.createReadStream(imgPath).pipe(pictureTube({cols: 30}));
    const concatStream = concat(imgBuffer => {
      resolve(imgBuffer.toString());
    });
    imgStream.on('error', reject);
    imgStream.pipe(concatStream);
  });
}

function help () {
  const chalk = require('chalk');
  const binName = pkgJson.libraryName || pkgJson.productName || Object.keys(pkgJson.bin)[0];
  const binStr = chalk.cyan.bold(binName);

  let logoContent = '';
  let bulletCounters = {
    examples: 0
  };

  let links = [];

  if (pkgJson.homepage) {
    links.push({name: 'Project homepage', summary: link(pkgJson.homepage)});
  }

  if (typeof pkgJson.bugs === 'string') {
    pkgJson.bugs = {url: pkgJson.bugs};
  }

  if (pkgJson.bugs && pkgJson.bugs.url) {
    links.push({name: 'File an issue', summary: link(pkgJson.bugs.url)});
  }

  return getHeaderLogo().then(content => {
    logoContent = content;
    displayUsage();
  }).catch(() => {
    displayUsage();
  });

  function link (url) {
    return chalk.underline(url);
  }

  function bullet (type, str) {
    return `${++bulletCounters[type]}. ${str}`;
  }

  function cmd (cmdName) {
    return chalk.magenta(cmdName);
  }

  function displayUsage () {
    const chalk = require('chalk');

    const sections = [
      {
        content: logoContent,
        raw: true
      },
      {
        header: binName,
        content: `${binStr} is a command-line tool for installing and automating the Firefox Reality virtual-reality browser.`
      },
      {
        header: 'Usage',
        content: `$ ${binStr} ${cmd('<command>')} ${chalk.blue('[options]')}`
      },
      {
        header: 'Commands',
        content: [
          {name: cmd('install'), summary: 'Install Firefox Reality to your device.'},
          {name: cmd('launch'), summary: 'Launch a URL in Firefox Reality.'},
          {name: cmd('version'), summary: 'Output the version number.'},
          {name: cmd('help'), summary: 'Output the usage information.'}
        ]
      },
      {
        header: 'Examples',
        content: [
          {
            desc: bullet('examples', 'Install Firefox Reality to your device.'),
            example: `$ ${binStr} ${cmd('install')}`
          },
          {
            desc: bullet('examples', 'Launch a URL in Firefox Reality.'),
            example: `$ ${binStr} ${cmd('launch')} "http://example.com/"`
          },
          // TODO: See https://github.com/MozillaReality/fxr-cli/issues/5
          // {
          //   desc: bullet('examples', 'Launch a local project in Firefox Reality.'),
          //   example: `$ ${binStr} ${cmd('launch')} path/to/project/`
          // }
        ]
      },
      {
        header: 'Links',
        content: links
      }
    ];

    const usage = commandLineUsage(sections);

    console.log(usage);
  }
}

function download () {
  return platformAction('download');
}

function install () {
  return platformAction('install');
}

function launch (url) {
  return platformAction('launch', url);
}

function test (url) {
  return platformAction('test', null);
}

function platformAction (action, url, defaults = {}) {
  return new Promise((resolve, reject) => {
    if (!('indent' in defaults)) {
      defaults.indent = 2;
    }
    const options = parseOptions(action, url, defaults);
    const actionStr = action;
    let actionPresentStr;
    let actionPastStr;
    let displayLogBefore = true;
    let displayLogAfter = true;
    let displayError = true;
    switch (action) {
      case 'download':
        actionPresentStr = 'downloading';
        actionPastStr = 'downloaded';
        displayLogAfter = false;
        break;
      case 'install':
        actionPresentStr = 'installing';
        actionPastStr = 'installed';
        displayLogAfter = false;
        break;
      case 'launch':
        actionPresentStr = 'launching';
        actionPastStr = 'launched';
        displayLogAfter = false;
        break;
      case 'test':
        actionPresentStr = 'testing';
        actionPastStr = 'tested';
        displayLogAfter = false;
        break;
    }

    const platformStr = pluralise('platform', 'platforms', options.platformsSlugs.length);
    const platformListStr = options.platformsSlugs.join('", "');

    const platform = options.platformsSlugs[0];

    const loggerPlatform = (str, level) => utils.loggerPlatform(platform, str, level);

    if (displayLogBefore) {
      loggerPlatform(uppercaseFirstLetter(actionPresentStr));
    }

    return commands[action].run({
      platformsSlugs: options.platformsSlugs,
      forceUpdate: options.forceUpdate,
      url: options.url,
      org: options.org || SETTINGS.github_org,
      repo: options.repo || SETTINGS.github_repo,
      indent: options.indent || '',
      test: options.test
    }).then(completed => {
      if (action === 'test') {
        return;
      }
      if (completed) {
        if (displayLogAfter) {
          loggerPlatform(uppercaseFirstLetter(actionPastStr));
        }
      }
    }).catch(err => {
      if (displayError) {
        if (err) {
          loggerPlatform(`Could not ${actionStr}: ${err}`, 'error');
        } else {
          loggerPlatform(`Could not ${actionStr}`, 'error');
        }
      } else {
        throw err;
      }
    });
  }).catch(err => {
    logger.error(err);
  });
}

switch (command) {
  case 'download':
    download();
    break;
  case 'install':
    install();
    break;
  case 'launch':
    launch();
    break;
  case 'test':
    test();
    break;
  case 'help':
    help();
    break;
  case 'version':
    version();
    break;
  default:
    if (argv.includes('-v') ||
        argv.includes('--v') ||
        argv.includes('--version')) {
      version();
      break;
    }
    help();
    break;
}
