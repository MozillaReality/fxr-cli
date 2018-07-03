#!/usr/bin/env node
process.on('unhandledRejection', err => { throw err; });
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

const pkgJson = require('./package.json');

const path = require('path');

const commandLineCommands = require('command-line-commands');
const commandLineUsage = require('command-line-usage');
const fs = require('fs-extra');
const logger = require('loggy');

const commands = require('./commands/index.js');
const parseOptions = require('./lib/parseCli.js').parseOptions;
const SETTINGS = require('./lib/settings.js').settings;
const utils = require('./lib/utils.js');

const SITES_URL = SETTINGS.sites_url;
const PLATFORMS_SLUGS = SETTINGS.platformsSlugs;

const parseBugsFromPkg = utils.parseBugsFromPkg;
const parseLicenseFromPkg = utils.parseLicenseFromPkg;
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
  const binName = pkgJson.libraryName || pkgJson.productName ||
    (typeof pkgJson.bin === 'object' ? Object.keys(pkgJson.bin)[0] : pkgJson.name);

  const binStr = `[bold]{[cyan]{${binName}}}`;

  let logoContent = '';
  let bulletCounters = {
    examples: 0
  };

  let links = [];
  if (pkgJson.homepage) {
    links.push({name: 'Project homepage', summary: link(pkgJson.homepage)});
  }
  let {bugsListUrl, bugsSubmitUrl} = parseBugsFromPkg(pkgJson);
  if (bugsListUrl) {
    links.push({name: 'List of issues', summary: link(bugsListUrl)});
  }
  if (bugsSubmitUrl) {
    links.push({name: 'File an issue', summary: link(bugsSubmitUrl)});
  }
  let {licenseType, licenseUrl} = parseLicenseFromPkg(pkgJson);
  if (licenseType) {
    links.push({name: 'Open-Source Software license', summary: `${licenseType} (${link(licenseUrl)})`});
  } else {
    links.push({name: 'Open-Source Software license', summary: link(licenseUrl)});
  }

  return getHeaderLogo().then(content => {
    logoContent = content;
    displayUsage();
  }).catch(() => {
    displayUsage();
  });

  function link (url) {
    return `[underline]{${url}}`;
  }

  function bullet (type, str) {
    return `${++bulletCounters[type]}. ${str}`;
  }

  function bulletExamples (str) {
    return bullet('examples', str);
  }

  function cmd (cmdName) {
    return `[magenta]{${cmdName}}`;
  }

  function displayUsage () {
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
        content: `$ ${binStr} ${cmd('<command>')} [blue]{[options]}`
      },
      {
        header: 'Commands',
        content: [
          {name: cmd('download'), summary: 'Download Firefox Reality to your PC.'},
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
            desc: bulletExamples('Download latest Oculus Go-compatible Firefox Reality to your PC.'),
            example: `$ ${binStr} ${cmd('download')}`
          },
          {
            desc: bulletExamples('Download latest Google Daydream-compatible Firefox Reality to your PC.'),
            example: `$ ${binStr} ${cmd('install')} daydream`
          },
          {
            desc: bulletExamples(
              `Download all platforms (${PLATFORMS_SLUGS.join('", "')}) for Firefox Reality to your PC.`),
            example: `$ ${binStr} ${cmd('install')} daydream`
          },
          {
            desc: bulletExamples('Install the downloaded Firefox Reality to your Oculus Go VR device.'),
            example: `$ ${binStr} ${cmd('install')}`
          },
          {
            desc: bulletExamples('Launch Firefox Reality.'),
            example: `$ ${binStr} ${cmd('launch')}`
          },
          {
            desc: bulletExamples('Launch a URL in Firefox Reality.'),
            example: `$ ${binStr} ${cmd('launch')} ${link('http://example.com/')}`
          },
          {
            desc: bulletExamples(`Run automated test suite for Firefox Reality (list of sites: ${SITES_URL}).`),
            example: `$ ${binStr} ${cmd('test')}`
          },
          {
            desc: bulletExamples('Output the version number.'),
            example: `$ ${binStr} ${cmd('version')}`
          },
          {
            desc: bulletExamples('Display a list of all commands and options.'),
            example: `$ ${binStr} ${cmd('help')}`
          }
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
  if (!('indent' in defaults)) {
    defaults.indent = 2;
  }
  const options = parseOptions(action, url, defaults);
  const actionStr = action;
  let actionPresentStr;
  let actionPastStr;
  switch (action) {
    case 'download':
      actionPresentStr = 'downloading';
      actionPastStr = 'downloaded';
      break;
    case 'install':
      actionPresentStr = 'installing';
      actionPastStr = 'installed';
      break;
    case 'launch':
      actionPresentStr = 'launching';
      actionPastStr = 'launched';
      break;
    case 'test':
      actionPresentStr = 'testing';
      actionPastStr = 'tested';
      break;
  }
  const platformStr = pluralise('platform', 'platforms', options.platformsSlugs.length);
  const platformListStr = options.platformsSlugs.join('", "');
  return new Promise((resolve, reject) => {
    logger.log(`${uppercaseFirstLetter(actionPresentStr)} ${platformStr} "${platformListStr}" …`);
    return commands[action].run({
      platformsSlugs: options.platformsSlugs,
      forceUpdate: options.forceUpdate,
      url: options.url
    }).then(completed => {
      if (action === 'test') {
        return;
      }
      if (completed) {
        logger.log(`Successfully ${actionPastStr} ${platformStr} "${platformListStr}"`);
        process.exit(0);
      }
    }).catch(err => {
      if (err) {
        logger.error(`Could not ${actionStr} ${platformStr} "${platformListStr}":`, err);
      } else {
        logger.error(`Could not ${actionStr} ${platformStr} "${platformListStr}"`);
      }
      process.exit(1);
    });
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
