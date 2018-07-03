const release = require('../scripts/release.js');

function release () {
  const result = release();
  process.exit(result.status);
}

if (module.parent) {
  module.exports.run = release;
} else {
  release();
}
