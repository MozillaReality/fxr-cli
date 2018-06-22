#!/usr/bin/env node
process.on('unhandledRejection', err => { throw err; });
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

const path = require('path');

const chalk = require('chalk');
const commandLineArgs = require('command-line-args');
const commandLineCommands = require('command-line-commands');
const commandLineUsage = require('command-line-usage');
const fs = require('fs-extra');
const logger = require('loggy');

const commands = require('./commands/index.js');
const pkgJson = require('./package.json');
const utils = require('./lib/utils.js');
const SETTINGS = require('./lib/settings.js').settings;

const getArgvPaths = utils.getArgvPaths;
const pluralise = utils.pluralise;
const uppercaseFirstLetter = utils.uppercaseFirstLetter;

const PLATFORMS = SETTINGS.platforms;
const PLATFORMS_SLUGS = SETTINGS.platformsSlugs;

const validCommands = [null, 'download', 'install', 'launch', 'version', 'help'];

switch (process.argv[2]) {
  case 'fetch':
    process.argv[2] = 'download';
  case 'update':
  case 'upgrade':
    process.argv[2] = 'install';
  case 'open':
  case 'run':
  case 'serve':
  case 'server':
  case 'dev':
  case 'url':
    process.argv[2] = 'launch';
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
  const binName = pkgJson.libraryName || pkgJson.productName || Object.keys(pkgJson.bin)[0];
  const binStr = `[bold]{[cyan]{${binName}}}`;

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
    return `[underline]{${url}}`;
  }

  function bullet (type, str) {
    return `${++bulletCounters[type]}. ${str}`;
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
        content: `${binStr} is a command-line tool for installing and automating Firefox Reality.`
      },
      {
        header: 'Usage',
        content: `$ ${binStr} ${cmd('<command>')} [blue]{[options]}`
      },
      {
        header: 'Commands',
        content: [
          {name: cmd('install'), summary: 'Install Firefox Reality to your device.'},
          {name: cmd('launch'), summary: 'Launch a URL in Firefox Reality.'},
          {name: cmd('version'), summary: 'Output the version number.'},
          {name: cmd('help'), summary: 'Output the usage information.'},
        ]
      },
      {
        header: 'Examples',
        content: [
          {
            desc: bullet('examples', 'Install Firefox Reality to your device.'),
            example: `$ ${binStr} ${cmd('install')}`,
          },
          {
            desc: bullet('examples', 'Launch a URL in Firefox Reality.'),
            example: `$ ${binStr} ${cmd('launch')} http://example.com/`,
          },
          {
            desc: bullet('examples', 'Launch a local project in Firefox Reality.'),
            example: `$ ${binStr} ${cmd('launch')} path/to/project/`,
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

function platformAction (action, url) {
  const optionDefinitions = [
    {name: 'platform', alias: 'p', type: String, multiple: true, defaultValue: [
      action === 'launch' ?
        SETTINGS.platform_default :
        (argv[0] || SETTINGS.platform_default)
    ]},
    {name: 'all', alias: 'a', type: String},
    {name: 'url', alias: 'u', type: String, defaultValue: url || argv[0]},
    {name: 'forceupdate', alias: 'f', type: String}
  ];
  const options = commandLineArgs(optionDefinitions, {argv});
  if (('all' in options) || !options.platform) {
    options.platform = PLATFORMS_SLUGS;
  } else {
    options.platform = options.platform.filter(platform => platform in PLATFORMS);
  }
  if (options.url) {
    options.platform = options.platform.length ? options.platform : [SETTINGS.platform_default];
  }
  // if (action === 'launch') {
  //   options.url = SETTINGS.launch_url_default;
  // }

  options.forceupdate = !utils.isTruthy(options.forceupdate) ? false : ('forceupdate' in options);

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
  }
  const platformStr = pluralise('platform', 'platforms', options.platform.length);
  const platformListStr = options.platform.join('", "');
  return new Promise((resolve, reject) => {
    logger.log(`${uppercaseFirstLetter(actionPresentStr)} ${platformStr} "${platformListStr}" …`);
    return commands[action].run({
      platformsSlugs: options.platform,
      forceUpdate: options.forceupdate,
      url: options.url
    }).then(completed => {
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
