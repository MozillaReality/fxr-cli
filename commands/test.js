const path = require('path');

const fuzzy = require('fuzzy');
const inquirer = require('inquirer');
const inquirerCheckboxPlusPrompt = require('inquirer-checkbox-plus-prompt');
const logger = require('loggy');
const shell = require('shelljs');

const SETTINGS = require('../lib/settings.js').settings;
const utils = require('../lib/utils.js');

function test (options) {
  options = Object.assign({}, {
    platformsSlugs: options.platformsSlugs || [SETTINGS.platform_default],
    forceUpdate: options.forceUpdate,
    url: options.url,
    sites: options.sites || [],
    pageSize: options.pageSize || SETTINGS.tests_page_size_default
  }, options);

  let sitesByName = {};
  let sitesChoices = [];
  options.sites.forEach(site => {
    sitesByName[site.name] = site;
    sitesChoices.push({
      url: site.url,
      name: site.name,
      value: `${site.name} ${site.slug} ${site.url} ${(site.keywords || []).join(' ')}`,
      short: site.url
    });
  });

  inquirer.registerPrompt('checkbox-plus', inquirerCheckboxPlusPrompt);

  return utils.requireAdb(options.forceUpdate).then(adb => {
    return options.platformsSlugs.map(platform => {
      // TODO: Check if the platform's APK is first installed on the device.
      const dirPlatform = path.join(__dirname, '..', 'downloads', platform);
      const pathApk = shell.find(path.join(dirPlatform, '*.apk'));
      if (!pathApk) {
        throw new Error(`Could not find APK for platform "${platform}"`);
      }

      // const devices = shell.exec(`${adb} devices`, {silent: true});
      // if (devices.stdout === 'List of devices attached\n\n') {
      //   throw new Error('Could not find connected device');
      // }

      // logger.log('\tPut your finger in front of the proximity sensor the Oculus Go');

      return inquirer.prompt([
        {
          type: 'checkbox-plus',
          name: 'sites',
          choices: sitesChoices,
          message: 'Choose a site to test',
          pageSize: options.pageSize,
          highlight: true,
          searchable: true,
          default: [
            options.sites[0]
          ],
          source: function (answersSoFar, input) {
            input = input || '';
            return new Promise(resolve => {
              const fuzzyResult = fuzzy.filter(input, options.sites, {
                extract: el => el.name
              });
              const matches = fuzzyResult.map(el => el.string);
              resolve(matches);
            });
          }
        }
      ]).then(function (answers) {
        return answers.sites.map(siteName => {
          const site = sitesByName[siteName];
          logger.log(`\tLaunching ${site.url}`);
          if (site.url) {
            shell.exec(`${adb} shell am start -a android.intent.action.VIEW -d "${site.url}" org.mozilla.vrbrowser/.VRBrowserActivity`, {silent: true});
          }
          return site;
        });
      });
    });
  });
}

module.exports.run = test;
