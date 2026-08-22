// 実行コマンド: node --test scripts/docs/test/validate-docs.node.js
// 用途: 文書間リンクとdocs索引からの到達性を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { validateDocumentation } = require('../internal/validate-docs');

// テスト用Markdownの絶対パスを組み立てる基準にする。
const projectRoot = path.resolve('/repository');

test('リンク、アンカー、docs indexからの到達性をまとめて検証する', () => {
    // 索引から辿れる文書と辿れない文書をメモリ上に用意する。
    const docsIndex = path.join(projectRoot, 'docs/index.md');
    const linkedFile = path.join(projectRoot, 'docs/linked.md');
    const unreachableFile = path.join(projectRoot, 'docs/unreachable.md');
    const files = new Map([
        [docsIndex, '# Index\n\n[Linked](linked.md#詳細)'],
        [linkedFile, '# Linked\n\n## 詳細'],
        [unreachableFile, '# Unreachable']
    ]);

    // 実ファイルを変更せず、用意した文書一式を検証する。
    const issues = validateDocumentation({
        docsIndex,
        docsMarkdownFiles: [...files.keys()],
        fileExists: (filePath) => files.has(filePath),
        fragmentMarkdownFiles: [],
        markdownFiles: [...files.keys()],
        projectRoot,
        readFile: (filePath) => files.get(filePath)
    });

    // 索引から辿れない文書だけが報告されることを確認する。
    assert.deepEqual(issues, ['docs/unreachable.md: docs/index.md から辿れません。']);
});
