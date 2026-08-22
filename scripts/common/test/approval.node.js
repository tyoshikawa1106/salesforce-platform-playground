// 実行コマンド: node --test scripts/common/test/approval.node.js
// 用途: 確認入力の生成と承認判定を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApprovalPrompt, isApproved } = require('../approval');

test('指定されたfactoryから確認入力を作成する', () => {
    const prompt = { question() {}, close() {} };

    assert.equal(
        createApprovalPrompt(() => prompt),
        prompt
    );
});

test('yまたはYだけを承認として扱う', () => {
    assert.equal(isApproved('y'), true);
    assert.equal(isApproved('Y'), true);

    for (const answer of ['', 'n', 'N', 'yes', undefined, null]) {
        assert.equal(isApproved(answer), false);
    }
});
