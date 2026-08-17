// 実行方法: Scratch Org関連スクリプトとテストスクリプトから読み込む。
// 用途: Scratch Orgの既定設定とリポジトリルートを共有する。

const path = require('node:path');

// Scratch Org関連スクリプトで共有するリポジトリルートと設定を読み込む。
const repoRoot = path.resolve(__dirname, '../../..');
const scratchOrgConfig = require('../scratch-org.json');

module.exports = {
    repoRoot,
    scratchOrg: scratchOrgConfig
};
