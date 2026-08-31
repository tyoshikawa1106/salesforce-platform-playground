// 実行コマンド: node --test scripts/docs/test/markdown-files.node.js
// 用途: 文書検証の対象と除外対象がリポジトリルールに一致することを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    getAdditionalDocumentMarkdownFiles,
    getDocsMarkdownFiles,
    getManagedMarkdownFiles,
    projectRoot
} = require('../internal/markdown-files');

test('現行文書を検査対象に含め、外部取得物と履歴文書を除外する', () => {
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

test('Git管理対象と未追跡・非除外のMarkdownを列挙する', () => {
    // Git呼び出しを差し替え、対象抽出に必要な引数を直接確認する。
    let invocation;
    const markdownFiles = getManagedMarkdownFiles(
        (command, args, options) => {
            invocation = { args, command, options };
            return 'README.md\ndocs/new-document.md\n';
        },
        () => true
    );

    assert.deepEqual(invocation, {
        args: ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'],
        command: 'git',
        options: { cwd: projectRoot, encoding: 'utf8' }
    });
    assert.deepEqual(
        markdownFiles.map((filePath) => path.relative(projectRoot, filePath).split(path.sep).join('/')),
        ['README.md', 'docs/new-document.md']
    );
});

test('作業ツリーから削除されたMarkdownを検査対象から除外する', () => {
    // Git管理一覧に残る削除済みパスを模擬し、存在する文書だけを抽出する。
    const markdownFiles = getManagedMarkdownFiles(
        () => 'README.md\ndocs/removed.md\n',
        (filePath) => !filePath.endsWith(`${path.sep}removed.md`)
    );

    assert.deepEqual(markdownFiles, [path.join(projectRoot, 'README.md')]);
});

test('一度取得したMarkdown一覧をdocs配下とdocs外へ分類する', () => {
    // Gitを再実行せず分類できるよう、検証対象一覧を直接渡す。
    const markdownFiles = [
        path.join(projectRoot, '.github/pull_request_template.md'),
        path.join(projectRoot, 'README.md'),
        path.join(projectRoot, 'docs/index.md')
    ];

    assert.deepEqual(getDocsMarkdownFiles(markdownFiles), [path.join(projectRoot, 'docs/index.md')]);
    assert.deepEqual(getAdditionalDocumentMarkdownFiles(markdownFiles), [path.join(projectRoot, 'README.md')]);
});
