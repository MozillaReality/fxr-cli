const commandLineArgs = require('command-line-args');

const utils = require('./utils.js');
const SETTINGS = require('./settings.js').settings;

const PLATFORMS = SETTINGS.platforms;
const PLATFORMS_SLUGS = SETTINGS.platformsSlugs;

const argv = utils.getArgv(process.argv);

function parseOptions (action, url, defaults = {}) {
  let optionDefinitions = [
    {
      name: 'platform',
      alias: 'p',
      type: String,
      multiple: true,
      defaultValue: [action === 'launch' ? SETTINGS.platform_default : (argv[1] || SETTINGS.platform_default)]
    },
    {
      name: 'all',
      alias: 'a',
      type: String
    }
  ];
  if (action === 'test') {
    optionDefinitions = optionDefinitions.concat([
      {
        name: 'reporter',
        alias: 'r',
        type: String,
        defaultValue: SETTINGS.test_reporter
      },
      {
        name: 'port',
        alias: 'P',
        type: String,
        defaultValue: SETTINGS.test_port}
    ]);
  } else {
    optionDefinitions.push(
      {
        name: 'url',
        alias: 'u',
        type: String,
        defaultValue: url || argv[1]
      }
    );
    optionDefinitions.push({
      name: 'test',
      alias: 't',
      type: String
    });
  }

  optionDefinitions = optionDefinitions.concat([
    {
      name: 'forceupdate',
      alias: 'f',
      type: String
    },
    {
      name: 'forceupdateadb',
      alias: 'A',
      type: String
    },
    {
      name: 'verbose',
      alias: 'v',
      type: String
    },
    {
      name: 'indent',
      alias: 'i',
      type: Number,
      defaultValue: ('indent' in defaults ? defaults.indent : 0)
    }
  ]);

  let options = commandLineArgs(optionDefinitions, {argv: process.argv, partial: true});
  if (('all' in options) || !options.platform) {
    options.platform = PLATFORMS_SLUGS;
  } else {
    options.platform = options.platform.map(platform => utils.getPlatform(platform).slug).filter(platform => (platform in PLATFORMS) && !!platform);
  }
  if (options.url) {
    options.platform = options.platform.length ? options.platform : [SETTINGS.platform_default];
    options.url = utils.cleanUrl(options.url);
  }
  options.test = utils.getBooleanFromString(options, 'test');
  options.platformsSlugs = options.platform;
  delete options.platform;
  if ('forceUpdate' in options) {
    options.forceupdate = options.forceUpdate;
    delete options.forceUpdate;
  }
  if ('forceUpdateAdb' in options) {
    options.forceupdateadb = options.forceUpdateAdb;
    delete options.forceUpdateAdb;
  }
  options.forceUpdate = utils.getBooleanFromString(options, 'forceupdate');
  options.forceUpdateAdb = utils.getBooleanFromString(options, 'forceupdateadb');
  options.verbose = utils.getBooleanFromString(options, 'verboe');
  options.indent = utils.getIndent(options.indent);

  return options;
}

module.exports.parseOptions = parseOptions;
