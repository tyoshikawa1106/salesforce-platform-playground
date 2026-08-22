// 実行方法: validate-docs.jsとテストスクリプトから読み込む。
// 用途: 1つのMarkdownの構造、ファイル名、安全でないコマンド例を検証する。

const path = require('node:path');

// Markdown内の記述場所にかかわらず拒否する文字列ルール。
const unsafeLineRules = Object.freeze([
    {
        message: 'WindowsのPythonインストール先を固定したPATH例にしないでください。',
        pattern: /(?:%LOCALAPPDATA%|\$env:LOCALAPPDATA)\\Programs\\Python\\Python313/i
    }
]);

// コードフェンスまたはインデントコード内だけで拒否するコマンドルール。
const unsafeCommandRules = Object.freeze([
    {
        message: 'setx PATH を実行例に使用しないでください。',
        pattern: /^setx(?:\.exe)?\s+"?path"?(?:\s|$)/i
    },
    {
        message: 'Salesforce CLIは公式Windowsインストーラーを案内してください。',
        pattern: /^winget\s+install\b.*\bSalesforce\.CLI\b/i
    },
    {
        message: 'Heroku CLIは公式Windowsインストーラーを案内してください。',
        pattern: /^winget\s+install\b.*\bHeroku\.HerokuCLI\b/i
    },
    {
        message: 'Code Analyzerは公式のplugin名code-analyzerで導入してください。',
        pattern: /^sf\s+plugins\s+install\s+@salesforce\/plugin-code-analyzer(?:\s|$)/i
    },
    {
        message: 'winget管理対象全体ではなく更新対象を個別に指定してください。',
        pattern: /^winget\s+upgrade\s+--all(?:\s|$)/i
    },
    {
        message: 'Homebrew管理対象全体を確認なしで変更しないでください。',
        pattern: /^brew\s+(?:upgrade|autoremove|cleanup)\s*$/i
    }
]);

// 検証結果のパス区切りをOSにかかわらずリポジトリ表記へ揃える。
function getRelativePath(projectRoot, filePath) {
    return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

// GitHub Markdownと同じ形式で見出しアンカーを作り、同名見出しには連番を付ける。
function createHeadingAnchor(heading, anchorCounts) {
    const baseAnchor = heading
        .toLowerCase()
        .replace(/[`*_~]/g, '')
        .trim()
        .replace(/\s/g, '-')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s/g, '');
    const count = anchorCounts.get(baseAnchor) || 0;

    anchorCounts.set(baseAnchor, count + 1);
    return count === 0 ? baseAnchor : `${baseAnchor}-${count}`;
}

// 1つのMarkdownから、見出し、ローカルリンク、構造上の問題を収集する。
function parseMarkdown({ content, filePath, projectRoot, requireH1 }) {
    const lines = content.split('\n');
    const anchors = new Set();
    const anchorCounts = new Map();
    const issues = [];
    const localLinks = [];
    let fenceMarker = null;
    let h1Count = 0;
    let previousHeadingLevel = 0;

    lines.forEach((line, index) => {
        // コードフェンス内の見出しやリンク例を文書構造として扱わない。
        const fenceMatch = line.trimStart().match(/^(```+|~~~+)/);

        if (fenceMatch) {
            if (fenceMarker === null) {
                fenceMarker = fenceMatch[1][0];
            } else if (fenceMarker === fenceMatch[1][0]) {
                fenceMarker = null;
            }
            return;
        }

        if (fenceMarker !== null) {
            return;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

        if (headingMatch) {
            const headingLevel = headingMatch[1].length;

            if (headingLevel === 1) {
                h1Count += 1;
            }

            // 見出しレベルが飛ぶと文書構造を追いにくいため問題として報告する。
            if (previousHeadingLevel > 0 && headingLevel > previousHeadingLevel + 1) {
                issues.push(
                    `${getRelativePath(projectRoot, filePath)}:${index + 1}: 見出しが H${previousHeadingLevel} から H${headingLevel} へ飛んでいます。`
                );
            }

            previousHeadingLevel = headingLevel;
            anchors.add(createHeadingAnchor(headingMatch[2], anchorCounts));
        }

        const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
        let linkMatch;

        while ((linkMatch = linkPattern.exec(line)) !== null) {
            let target = linkMatch[1].trim();

            if (target.startsWith('<') && target.endsWith('>')) {
                target = target.slice(1, -1);
            }

            if (/^(https?:|mailto:)/.test(target)) {
                continue;
            }

            // 存在確認とアンカー確認は全ファイルの解析後にまとめて行う。
            localLinks.push({ line: index + 1, target });
        }
    });

    if (requireH1 && h1Count !== 1) {
        issues.push(`${getRelativePath(projectRoot, filePath)}: H1 は1つ必要です。現在は ${h1Count} 個です。`);
    }

    return { anchors, issues, localLinks };
}

// docs配下のMarkdownファイル名をindexまたはkebab-caseへ統一する。
function validateFileName(filePath, projectRoot) {
    const fileName = path.basename(filePath, '.md');

    if (fileName === 'index' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fileName)) {
        return [];
    }

    return [`${getRelativePath(projectRoot, filePath)}: ファイル名を kebab-case にしてください。`];
}

// コードフェンスの開始・終了を判定し、次の行で使用するmarkerを返す。
function getNextFenceMarker(line, currentMarker) {
    const marker = line.trimStart().match(/^(```+|~~~+)/)?.[1];

    if (!marker) {
        return { isFenceLine: false, marker: currentMarker };
    }

    if (currentMarker === null) {
        return { isFenceLine: true, marker };
    }

    const closesFence = currentMarker[0] === marker[0] && marker.length >= currentMarker.length;
    return { isFenceLine: true, marker: closesFence ? null : currentMarker };
}

// コード例の行からshell promptとインデントを除いたコマンドを取得する。
function getCodeExampleCommand(line, fenceMarker) {
    const isIndentedCode = /^(?: {4}|\t)/.test(line);

    if (fenceMarker === null && !isIndentedCode) {
        return null;
    }

    return line
        .replace(/^(?: {4}|\t)/, '')
        .trimStart()
        .replace(/^(?:PS(?:\s+[^>]*)?>|[A-Z]:\\[^>]*>|\$)\s*/i, '');
}

// 1行の内容に一致するルールを、行番号付きの問題へ変換する。
function collectRuleIssues({ filePath, index, projectRoot, rules, value }) {
    return rules
        .filter(({ pattern }) => pattern.test(value))
        .map(({ message }) => `${getRelativePath(projectRoot, filePath)}:${index + 1}: ${message}`);
}

// 端末環境や他ツールまで広く変更する危険なコマンド例が文書にないか確認する。
function validateUnsafeCommandExamples({ content, filePath, projectRoot }) {
    const issues = [];
    let fenceMarker = null;

    content.split('\n').forEach((line, index) => {
        issues.push(...collectRuleIssues({ filePath, index, projectRoot, rules: unsafeLineRules, value: line }));

        const fence = getNextFenceMarker(line, fenceMarker);
        fenceMarker = fence.marker;

        if (fence.isFenceLine) {
            return;
        }

        const command = getCodeExampleCommand(line, fenceMarker);

        // 説明文でコマンド名に言及しただけの場合は実行例として扱わない。
        if (command === null) {
            return;
        }

        issues.push(...collectRuleIssues({ filePath, index, projectRoot, rules: unsafeCommandRules, value: command }));
    });

    return issues;
}

module.exports = {
    createHeadingAnchor,
    getRelativePath,
    parseMarkdown,
    validateFileName,
    validateUnsafeCommandExamples
};
