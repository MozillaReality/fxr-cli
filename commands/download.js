const path = require('path');

const fetch = require('node-fetch');
const fs = require('fs-extra');
const logger = require('loggy');

const utils = require('../lib/utils.js');
const SETTINGS = require('../lib/settings.js').settings;

const getPlatform = utils.getPlatform;

const PATHS = SETTINGS.paths;
const PLATFORMS = SETTINGS.platforms;
const PLATFORMS_SLUGS = SETTINGS.platformsSlugs;

const URLS = {
  taskcluster: {
    repo: (org, repo) => `https://github.taskcluster.net/v1/repository/${org}/${repo}/master/latest`,
    queue: (taskId) => `https://queue.taskcluster.net/v1/task/${taskId}/runs/0/artifacts`,
    artifact: (taskId, artifactName) => `https://queue.taskcluster.net/v1/task/${taskId}/runs/0/artifacts/${artifactName}`
  }
};

function getTaskIdFromUri (uri) {
  return uri.split('#/')[1];
}

function parseTask (taskId, taskUrl, platformsSlugs = PLATFORMS_SLUGS) {
  let artifacts = [];
  function saveDownloadsIndex () {
    const data = {
      artifacts,
      taskId,
      taskUrl,
      saved: new Date().toJSON()
    };
    fs.writeJsonSync(PATHS.downloads_index, data, {spaces: 2}, err => {
      if (err) {
        logger.error(err);
      }
    });
  }
  return fetch(URLS.taskcluster.queue(taskId))
    .then(res => res.json())
    .then(data => {
      artifacts = data.artifacts.map(artifact => {
        artifact.url = URLS.taskcluster.artifact(taskId, artifact.name);
        artifact.basename = path.basename(artifact.name);
        artifact.platform = artifact.storageType === 'reference' ? null : getPlatform(artifact.basename);
        artifact.status = artifact.platform && platformsSlugs.includes(artifact.platform.slug) ? 'queued' : 'skipped';
        return artifact;
      });
      saveDownloadsIndex();
      return artifacts;
    }).then(artifacts => {
      return Promise.all(artifacts.map(artifact => {
        if (artifact.status === 'skipped') {
          artifact.status = 'skipped';
          return Promise.resolve(artifact);
        }
        if (artifact.status === 'queued') {
          artifact.status = 'downloading';
          saveDownloadsIndex();
        }
        return fetch(artifact.url).then(res => {
          return new Promise((resolve, reject) => {
            const localFilename = path.resolve(PATHS.downloads, artifact.platform.slug, artifact.basename);
            const destStream = fs.createWriteStream(localFilename);
            res.body.pipe(destStream);
            res.body.on('error', err => {
              saveDownloadsIndex();
              logger.error(err);
              reject(err);
            });
            destStream.on('finish', () => {
              artifact.status = 'downloaded';
              artifact.downloaded = new Date().toJSON();
              logger.log(`\tSuccessfully downloaded "${artifact.platform.slug}" package`);
              saveDownloadsIndex();
              resolve(artifact);
            });
            destStream.on('error', err => {
              saveDownloadsIndex();
              logger.error(err);
              reject(err);
            });
          });
        });
      }));
    }).then(() => {
      saveDownloadsIndex();
      return true;
    });
}

function download (options = {}) {
  options = Object.assign({}, {
    platformsSlugs: options.platformsSlugs || [SETTINGS.platform_default],
    forceUpdate: options.forceUpdate,
    org: options.org || SETTINGS.github_org,
    repo: options.repo || SETTINGS.github_repo,
  }, options);
  fs.emptyDirSync(PATHS.downloads);
  options.platformsSlugs.forEach(platform => fs.ensureDirSync(path.resolve(PATHS.downloads, platform)));
  const taskRepoUrl = URLS.taskcluster.repo(options.org, options.repo);
  return fetch(taskRepoUrl, {method: 'HEAD', redirect: 'manual'})
    .then(res => {
      const taskUrl = res.headers.get('location');
      return {
        taskId: getTaskIdFromUri(taskUrl),
        taskUrl
      };
    })
    .then(({taskId, taskUrl}) => parseTask(taskId, taskUrl, options.platformsSlugs));
}

module.exports.run = download;
