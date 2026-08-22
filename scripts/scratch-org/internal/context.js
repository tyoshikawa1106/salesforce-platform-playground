// 実行方法: Scratch Org関連スクリプトとテストスクリプトから読み込む。
// 用途: Scratch Orgの既定設定とリポジトリルートを共有する。

const path = require('node:path');

// Scratch Org関連スクリプトで共有するリポジトリルートと設定を読み込む。
const repoRoot = path.resolve(__dirname, '../../..');
// aliasやmanifestなどScratch Org再現用の設定を1か所から読み込む。
const scratchOrgConfig = require('../scratch-org.json');

// 各stepが同じルートと設定を使えるよう共通contextとして公開する。
module.exports = {
    repoRoot,
    scratchOrg: scratchOrgConfig
};
