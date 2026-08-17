// 実行方法: Scratch Org関連スクリプトとテストスクリプトから読み込む。
// 用途: Scratch Orgのalias、設定値、リポジトリルートを共有する。

const path = require('node:path');

// Scratch Org関連スクリプトで共有するリポジトリルートと設定を読み込む。
const repoRoot = path.resolve(__dirname, '../../..');
const scratchOrgConfig = require('../scratch-org.json');

// 一時的なalias指定を許可し、未指定時はリポジトリの既定値を使用する。
function resolveScratchOrgAlias() {
    return process.env.SCRATCH_ORG_ALIAS || scratchOrgConfig.alias;
}

// 各スクリプトが同じaliasと設定値を参照できる形に揃える。
const scratchOrg = {
    ...scratchOrgConfig,
    alias: resolveScratchOrgAlias()
};

module.exports = {
    repoRoot,
    scratchOrg
};
