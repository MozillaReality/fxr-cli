function test (options) {
  return require('../tests/sites/index.js')(options);
}

module.exports.run = test;
