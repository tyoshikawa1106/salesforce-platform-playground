// 実行コマンド: npm run sf:test:flow
// 用途: Default Target Orgを確認し、ローカルFlowテストを全件開始する。

const { createOrgTestMain, startOrgTest } = require('./internal/run-org-test');

// Flow固有の表示とテスト種別を、組織テストの共通処理へ渡す。
const main = createOrgTestMain({
    testLabel: 'Flow',
    testType: 'flow',
    usage: 'npm run sf:test:flow'
});

// コマンドとして実行された場合だけFlowテストを開始する。
if (require.main === module) {
    // Flow用mainを共通の終了コード処理で開始する。
    startOrgTest(main, 'Flow');
}

// 承認分岐を組織接続なしでテストできるようmainを公開する。
module.exports = { main };
