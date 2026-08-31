// 実行コマンド: node --test scripts/docs/test/validate-markdown.node.js
// 用途: 1つのMarkdownの解析、構造、危険なコマンド例を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseMarkdown, validateUnsafeCommandExamples } = require('../internal/validate-markdown');

// テスト用Markdownの絶対パスを組み立てる基準にする。
const projectRoot = path.resolve('/repository');

// 1つのMarkdownを共通のテストファイルとして危険コマンド検査へ渡す。
function validateUnsafeContent(content, relativePath = 'docs/example.md') {
    return validateUnsafeCommandExamples({
        content,
        filePath: path.join(projectRoot, relativePath),
        projectRoot
    });
}

test('Markdownの見出し、重複アンカー、ローカルリンクを解析する', () => {
    // 重複見出しとローカルリンクを含むMarkdownを解析する。
    const filePath = path.join(projectRoot, 'docs/example.md');
    const parsed = parseMarkdown({
        content: '# 見出し\n\n## 同じ\n\n## 同じ\n\n[詳細](target.md#対象)',
        filePath,
        projectRoot,
        requireH1: true
    });

    // アンカー、リンク、問題一覧が期待どおりであることを確認する。
    assert.deepEqual([...parsed.anchors], ['見出し', '同じ', '同じ-1']);
    assert.deepEqual(parsed.localLinks, [{ line: 7, target: 'target.md#対象' }]);
    assert.deepEqual(parsed.issues, []);
});

test('コードフェンス内の見出しを無視し、見出しレベルの飛びを報告する', () => {
    // コードフェンスとH1からH3への見出しレベル飛びを含むMarkdownを解析する。
    const filePath = path.join(projectRoot, 'docs/example.md');
    const parsed = parseMarkdown({
        content: '# 見出し\n\n~~~md\n### 対象外\n~~~\n\n### 飛んだ見出し',
        filePath,
        projectRoot,
        requireH1: true
    });

    // コード内の見出しを除外し、見出しレベルの問題を検出することを確認する。
    assert.deepEqual([...parsed.anchors], ['見出し', '飛んだ見出し']);
    assert.match(parsed.issues[0], /H1 から H3/);
});

const longFenceCases = [
    { close: '````', name: 'backtick', open: '````md', shorterMarker: '```' },
    { close: '~~~~', name: 'tilde', open: '~~~~md', shorterMarker: '~~~' }
];

for (const { close, name, open, shorterMarker } of longFenceCases) {
    test(`長い${name}フェンス内の短いmarker、見出し、リンクを無視する`, () => {
        // 外側より短い同種markerを含むコードブロックと、通常の文書見出しを解析する。
        const filePath = path.join(projectRoot, 'docs/example.md');
        const parsed = parseMarkdown({
            content: [
                '# 見出し',
                '',
                open,
                '## 対象外',
                shorterMarker,
                '### まだ対象外',
                '[対象外リンク](missing.md)',
                close,
                '',
                '## 対象'
            ].join('\n'),
            filePath,
            projectRoot,
            requireH1: true
        });

        // 長いフェンスの外側にある文書構造だけを収集することを確認する。
        assert.deepEqual([...parsed.anchors], ['見出し', '対象']);
        assert.deepEqual(parsed.localLinks, []);
        assert.deepEqual(parsed.issues, []);
    });
}

for (const { name, open } of longFenceCases) {
    test(`閉じていない${name}フェンスを開始行付きで報告する`, () => {
        const filePath = path.join(projectRoot, 'docs/example.md');
        const parsed = parseMarkdown({
            content: ['# 見出し', '', open, '[対象外リンク](missing.md)'].join('\n'),
            filePath,
            projectRoot,
            requireH1: true
        });

        assert.deepEqual(parsed.localLinks, []);
        assert.deepEqual(parsed.issues, ['docs/example.md:3: コードフェンスが閉じられていません。']);
    });
}

test('コードブロック内のsetx PATHを拒否し、注意書きでの言及は許可する', () => {
    // 注意書きと実行例の両方にsetx PATHを含むMarkdownを検証する。
    const issues = validateUnsafeContent(
        '# Example\n\n`setx PATH` は使用しません。\n\n```powershell\nsetx PATH "$env:PATH;C:\\Tools"\n```'
    );

    // 実行例だけが問題として報告されることを確認する。
    assert.deepEqual(issues, ['docs/example.md:6: setx PATH を実行例に使用しないでください。']);
});

test('インデント形式とshell prompt付きのsetx PATHを拒否する', () => {
    // 複数形式のsetx PATH実行例を含むMarkdownを検証する。
    const issues = validateUnsafeContent(
        '# Example\n\n    setx PATH "C:\\Tools"\n\n```powershell\nPS> setx.exe "PATH" "C:\\Tools"\nPS C:\\Users\\Example> setx PATH "C:\\Tools"\n```\n\n```bat\nC:\\>setx PATH "C:\\Tools"\n```'
    );

    // すべての実行例が行番号付きで報告されることを確認する。
    assert.deepEqual(issues, [
        'docs/example.md:3: setx PATH を実行例に使用しないでください。',
        'docs/example.md:6: setx PATH を実行例に使用しないでください。',
        'docs/example.md:7: setx PATH を実行例に使用しないでください。',
        'docs/example.md:11: setx PATH を実行例に使用しないでください。'
    ]);
});

const unsafeCommandCases = [
    {
        command: 'winget install --id Salesforce.CLI -e',
        message: 'Salesforce CLIは公式Windowsインストーラーを案内してください。',
        name: 'Salesforce CLIのwinget導入'
    },
    {
        command: 'winget install --id Heroku.HerokuCLI -e',
        message: 'Heroku CLIは公式Windowsインストーラーを案内してください。',
        name: 'Heroku CLIのwinget導入'
    },
    {
        command: 'sf plugins install @salesforce/plugin-code-analyzer',
        message: 'Code Analyzerは公式のplugin名code-analyzerで導入してください。',
        name: '廃止したCode Analyzer plugin名'
    },
    {
        command: 'winget upgrade --all',
        message: 'winget管理対象全体ではなく更新対象を個別に指定してください。',
        name: 'wingetの全体更新'
    },
    {
        command: 'brew upgrade',
        message: 'Homebrew管理対象全体を確認なしで変更しないでください。',
        name: 'Homebrewの全体更新'
    },
    {
        command: 'brew autoremove',
        message: 'Homebrew管理対象全体を確認なしで変更しないでください。',
        name: 'Homebrewの一括削除'
    },
    {
        command: 'brew cleanup',
        message: 'Homebrew管理対象全体を確認なしで変更しないでください。',
        name: 'Homebrewの一括cleanup'
    }
];

for (const { command, message, name } of unsafeCommandCases) {
    test(`${name}をコード例では拒否する`, () => {
        const issues = validateUnsafeContent(`# Example\n\n\`\`\`sh\n${command}\n\`\`\``);

        assert.deepEqual(issues, [`docs/example.md:4: ${message}`]);
    });

    test(`${name}への説明文での言及は許可する`, () => {
        assert.deepEqual(validateUnsafeContent(`# Example\n\n\`${command}\` は実行しません。`), []);
    });
}

test('固定したWindows Python PATHはコード例以外でも拒否する', () => {
    const issues = validateUnsafeContent('# Example\n\n- `%LOCALAPPDATA%\\Programs\\Python\\Python313`');

    assert.deepEqual(issues, ['docs/example.md:3: WindowsのPythonインストール先を固定したPATH例にしないでください。']);
});

const allowedCommandCases = ['brew cleanup --dry-run', 'brew upgrade git gh', 'winget upgrade Git.Git'];

for (const command of allowedCommandCases) {
    test(`対象を限定したコマンドを許可する: ${command}`, () => {
        assert.deepEqual(validateUnsafeContent(`# Example\n\n\`\`\`sh\n${command}\n\`\`\``), []);
    });
}
