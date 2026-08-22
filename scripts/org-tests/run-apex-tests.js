// 実行コマンド: npm run sf:test:apex
// 用途: Default Target Orgを確認し、ローカルApexテストを全件開始する。

const { createOrgTestMain, startOrgTest } = require('./internal/run-org-test');

// Apex固有の表示とテスト種別を、組織テストの共通処理へ渡す。
const main = createOrgTestMain({
    testLabel: 'Apex',
    testType: 'apex',
    usage: 'npm run sf:test:apex'
});

// コマンドとして実行された場合だけApexテストを開始する。
if (require.main === module) {
    startOrgTest(main, 'Apex');
}

module.exports = { main };
