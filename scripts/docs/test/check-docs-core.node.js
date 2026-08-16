const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseMarkdown, validateDocumentation, validateUnsafeCommandExamples } = require('../check-docs-core');

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

test('コードブロック内のsetx PATHを拒否し、注意書きでの言及は許可する', () => {
    const filePath = path.join(projectRoot, 'docs/example.md');
    const issues = validateUnsafeCommandExamples({
        content: '# Example\n\n`setx PATH` は使用しません。\n\n```powershell\nsetx PATH "$env:PATH;C:\\Tools"\n```',
        filePath,
        projectRoot
    });

    assert.deepEqual(issues, ['docs/example.md:6: setx PATH を実行例に使用しないでください。']);
});

test('インデント形式とshell prompt付きのsetx PATHを拒否する', () => {
    const filePath = path.join(projectRoot, 'docs/example.md');
    const issues = validateUnsafeCommandExamples({
        content:
            '# Example\n\n    setx PATH "C:\\Tools"\n\n```powershell\nPS> setx.exe "PATH" "C:\\Tools"\nPS C:\\Users\\Example> setx PATH "C:\\Tools"\n```\n\n```bat\nC:\\>setx PATH "C:\\Tools"\n```',
        filePath,
        projectRoot
    });

    assert.deepEqual(issues, [
        'docs/example.md:3: setx PATH を実行例に使用しないでください。',
        'docs/example.md:6: setx PATH を実行例に使用しないでください。',
        'docs/example.md:7: setx PATH を実行例に使用しないでください。',
        'docs/example.md:11: setx PATH を実行例に使用しないでください。'
    ]);
});

test('廃止したWindowsセットアップコマンドと固定Python PATHを拒否する', () => {
    const filePath = path.join(projectRoot, 'docs/setup/windows-winget-setup.md');
    const issues = validateUnsafeCommandExamples({
        content:
            '# Example\n\n- `%LOCALAPPDATA%\\Programs\\Python\\Python313`\n\n```text\nwinget install --id Salesforce.CLI -e\nwinget install --id Heroku.HerokuCLI -e\nsf plugins install @salesforce/plugin-code-analyzer\n```',
        filePath,
        projectRoot
    });

    assert.deepEqual(issues, [
        'docs/setup/windows-winget-setup.md:3: WindowsのPythonインストール先を固定したPATH例にしないでください。',
        'docs/setup/windows-winget-setup.md:6: Salesforce CLIは公式Windowsインストーラーを案内してください。',
        'docs/setup/windows-winget-setup.md:7: Heroku CLIは公式Windowsインストーラーを案内してください。',
        'docs/setup/windows-winget-setup.md:8: Code Analyzerは公式のplugin名code-analyzerで導入してください。'
    ]);
});

test('対象を限定しないパッケージ更新と削除を拒否する', () => {
    const filePath = path.join(projectRoot, 'docs/setup/example.md');
    const issues = validateUnsafeCommandExamples({
        content:
            '# Example\n\n```sh\nwinget upgrade --all\nbrew upgrade\nbrew autoremove\nbrew cleanup\nbrew cleanup --dry-run\nbrew upgrade git gh\n```',
        filePath,
        projectRoot
    });

    assert.deepEqual(issues, [
        'docs/setup/example.md:4: winget管理対象全体ではなく更新対象を個別に指定してください。',
        'docs/setup/example.md:5: Homebrew管理対象全体を確認なしで変更しないでください。',
        'docs/setup/example.md:6: Homebrew管理対象全体を確認なしで変更しないでください。',
        'docs/setup/example.md:7: Homebrew管理対象全体を確認なしで変更しないでください。'
    ]);
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
