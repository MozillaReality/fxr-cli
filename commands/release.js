const releaseScript = require('../scripts/release.js');

function release () {
  const result = releaseScript();
  process.exit(result.status);
}

if (module.parent) {
  module.exports.run = release;
} else {
  release();
}
