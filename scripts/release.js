const spawn = require('child_process').spawnSync;

const chalk = require('chalk');

const spawnSyncOptions = {stdio: 'inherit'};

const build = () => spawn.sync('npm', ['run', 'build'], spawnSyncOptions);
const push = () => spawn.sync('git', ['push', 'origin', 'master'], spawnSyncOptions);

const release = () => {
  process.env.CI = true;

  const buildResult = build();
  if (buildResult.status !== 0) {
    process.exit(buildResult.status);
  }

  console.log(chalk.green('Starting the release 🚀'));
  console.log();
  const releaseResult = spawn.sync(
    require.resolve('publish-please/bin/publish-please'),
    [],
    {
      stdio: 'inherit'
    }
  );

  if (releaseResult.status === 0) {
    console.log(chalk.green('Pushing to GitHub'));
    push();
    console.log('Done 🎉');
  }

  return releaseResult;
};

module.exports = release;
