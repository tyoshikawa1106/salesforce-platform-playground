const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const scratchOrgConfig = require('./scratch-org.json');

function resolveScratchOrgAlias() {
    return process.env.SCRATCH_ORG_ALIAS || scratchOrgConfig.alias;
}

const scratchOrg = {
    ...scratchOrgConfig,
    alias: resolveScratchOrgAlias()
};

module.exports = {
    repoRoot,
    scratchOrg
};
