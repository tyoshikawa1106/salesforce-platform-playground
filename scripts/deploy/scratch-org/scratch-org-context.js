const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const scratchOrg = require('./scratch-org.json');

module.exports = {
    repoRoot,
    scratchOrg
};
