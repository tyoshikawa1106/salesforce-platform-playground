// 実行コマンド: node --test scripts/docs/test/markdown-files.node.js
// 用途: 文書検証の対象と除外対象がリポジトリルールに一致することを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getManagedMarkdownFiles, projectRoot } = require('../internal/markdown-files');

test('Git 管理する現行文書を検査対象に含め、履歴文書を除外する', () => {
    // 管理対象のMarkdownをリポジトリルートからの相対パスへ変換する。
    const markdownFiles = getManagedMarkdownFiles();
    const relativePaths = markdownFiles.map((filePath) =>
        path.relative(projectRoot, filePath).split(path.sep).join('/')
    );

    // 対象一覧に重複がないことを確認する。
    assert.equal(new Set(markdownFiles).size, markdownFiles.length);

    // docs外で管理する文書が検証対象に含まれることを確認する。
    assert.ok(relativePaths.includes('.github/pull_request_template.md'));
    assert.ok(relativePaths.includes('.clinerules/repository.md'));
    assert.ok(relativePaths.includes('.cline/skills/salesforce-skills/SKILL.md'));
    // 外部取得物と履歴文書が検証対象から除外されることを確認する。
    assert.ok(relativePaths.every((filePath) => !filePath.startsWith('.agents/skills/')));
    assert.ok(relativePaths.every((filePath) => !filePath.startsWith('docs/knowledge/')));
    assert.ok(relativePaths.every((filePath) => !filePath.startsWith('docs/discussions/')));
    // 抽出された文書がすべて存在することを確認する。
    assert.ok(markdownFiles.every((filePath) => fs.existsSync(filePath)));
});
