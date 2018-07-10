const spawnSync = require('child_process').spawnSync;

const exec = (arg0, args) => spawnSync(arg0, args, {stdio: 'inherit'});

const stash = () => exec('git', ['stash']);
const stashApply = () => exec('git', ['stash', 'apply']);
const checkout = () => exec('git', ['checkout', 'master']);
const push = () => exec('git', ['push', 'origin', 'master']);

const release = () => {
  const chalk = require('chalk');
  process.env.CI = true;

  const stashResult = stash();
  if (stashResult.status !== 0) {
    process.exit(stashResult.status);
  }

  const checkoutResult = checkout();
  if (checkoutResult.status !== 0) {
    process.exit(checkoutResult.status);
  }

  console.log(chalk.green('Starting the release 🚀'));
  console.log();
  const releaseResult = spawnSync(
    require.resolve('publish-please/bin/publish-please'),
    [],
    {stdio: 'inherit'}
  );

  if (releaseResult.status === 0) {
    console.log(chalk.green('Pushing to GitHub'));
    push();
    console.log('Done 🎉');
  }

  const stashApplyResult = stashApply();
  if (stashApplyResult.status !== 0) {
    process.exit(stashApplyResult.status);
  }

  return releaseResult;
};

if (module.parent) {
  module.exports.run = release;
} else {
  release();
}
