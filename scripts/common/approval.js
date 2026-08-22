// 実行方法: 利用者の承認が必要なNodeスクリプトから読み込む。
// 用途: ターミナルの確認入力を作成し、明示的な承認だけを判定する。

const { createInterface } = require('node:readline/promises');

// テストでは差し替えた入力を使用し、通常実行では標準入出力へ接続する。
function createApprovalPrompt(promptFactory, input = process.stdin, output = process.stdout) {
    // 呼び出し元が用意したpromptを優先し、テスト時に端末入力を発生させない。
    return promptFactory?.() ?? createInterface({ input, output });
}

// yまたはYだけを明示的な承認として扱う。
function isApproved(answer) {
    // Enterやyesを暗黙に承認せず、明示された1文字だけを許可する。
    return answer === 'y' || answer === 'Y';
}

module.exports = { createApprovalPrompt, isApproved };
