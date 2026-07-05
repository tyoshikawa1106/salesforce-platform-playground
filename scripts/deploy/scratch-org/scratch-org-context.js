const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const scratchOrgConfig = require('./scratch-org.json');

function formatLocalDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
}

function getScratchOrgAliasBase() {
    return `${scratchOrgConfig.aliasPrefix}-${formatLocalDate()}`;
}

function resolveScratchOrgAlias() {
    return process.env.SCRATCH_ORG_ALIAS || getScratchOrgAliasBase();
}

const scratchOrg = {
    ...scratchOrgConfig,
    alias: resolveScratchOrgAlias()
};

module.exports = {
    formatLocalDate,
    repoRoot,
    scratchOrg
};
