const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseMarkdown, validateDocumentation } = require('../check-docs-core');

const projectRoot = path.resolve('/repository');

test('Markdownの見出し、重複アンカー、ローカルリンクを解析する', () => {
    const filePath = path.join(projectRoot, 'docs/example.md');
    const parsed = parseMarkdown({
        content: '# 見出し\n\n## 同じ\n\n## 同じ\n\n[詳細](target.md#対象)',
        filePath,
        projectRoot,
        requireH1: true
    });

    assert.deepEqual([...parsed.anchors], ['見出し', '同じ', '同じ-1']);
    assert.deepEqual(parsed.localLinks, [{ line: 7, target: 'target.md#対象' }]);
    assert.deepEqual(parsed.issues, []);
});

test('コードフェンス内の見出しを無視し、見出しレベルの飛びを報告する', () => {
    const filePath = path.join(projectRoot, 'docs/example.md');
    const parsed = parseMarkdown({
        content: '# 見出し\n\n~~~md\n### 対象外\n~~~\n\n### 飛んだ見出し',
        filePath,
        projectRoot,
        requireH1: true
    });

    assert.deepEqual([...parsed.anchors], ['見出し', '飛んだ見出し']);
    assert.match(parsed.issues[0], /H1 から H3/);
});

test('リンク、アンカー、docs indexからの到達性をまとめて検証する', () => {
    const docsIndex = path.join(projectRoot, 'docs/index.md');
    const linkedFile = path.join(projectRoot, 'docs/linked.md');
    const unreachableFile = path.join(projectRoot, 'docs/unreachable.md');
    const files = new Map([
        [docsIndex, '# Index\n\n[Linked](linked.md#詳細)'],
        [linkedFile, '# Linked\n\n## 詳細'],
        [unreachableFile, '# Unreachable']
    ]);

    const issues = validateDocumentation({
        docsIndex,
        docsMarkdownFiles: [...files.keys()],
        fileExists: (filePath) => files.has(filePath),
        fragmentMarkdownFiles: [],
        markdownFiles: [...files.keys()],
        projectRoot,
        readFile: (filePath) => files.get(filePath)
    });

    assert.deepEqual(issues, ['docs/unreachable.md: docs/index.md から辿れません。']);
});
