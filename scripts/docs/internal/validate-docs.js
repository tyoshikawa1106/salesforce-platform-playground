// 実行方法: check-docs.jsとテストスクリプトから読み込む。
// 用途: 管理対象文書を横断し、リンクと索引到達性を検証する。

const path = require('node:path');
const {
    getRelativePath,
    parseMarkdown,
    validateFileName,
    validateUnsafeCommandExamples
} = require('./validate-markdown');

// 管理対象文書を横断し、構造、リンク、安全でないコマンド例、索引到達性を確認する。
function validateDocumentation({
    docsIndex,
    docsMarkdownFiles,
    fileExists,
    fragmentMarkdownFiles,
    markdownFiles,
    projectRoot,
    readFile
}) {
    const issues = [];
    const fragmentMarkdownFileSet = new Set(fragmentMarkdownFiles);
    const markdownFileSet = new Set(markdownFiles);
    const parsedFiles = new Map();
    const linkGraph = new Map();

    // ファイル名ルールはdocs配下だけに適用する。
    for (const filePath of docsMarkdownFiles) {
        issues.push(...validateFileName(filePath, projectRoot));
    }

    // 先に全Markdownを解析し、後続のファイル間リンク検証に利用する。
    for (const filePath of markdownFiles) {
        const content = readFile(filePath);
        const parsed = parseMarkdown({
            content,
            filePath,
            projectRoot,
            requireH1: !fragmentMarkdownFileSet.has(filePath)
        });

        parsedFiles.set(filePath, parsed);
        issues.push(...parsed.issues);
        issues.push(...validateUnsafeCommandExamples({ content, filePath, projectRoot }));
    }

    // ローカルリンクのファイルとアンカーを確認し、文書間のリンクグラフを作る。
    for (const filePath of markdownFiles) {
        const linkedMarkdownFiles = [];

        for (const { line, target } of parsedFiles.get(filePath).localLinks) {
            const [rawPath, rawAnchor] = target.split('#', 2);
            const targetPath = rawPath ? path.resolve(path.dirname(filePath), decodeURIComponent(rawPath)) : filePath;

            if (!fileExists(targetPath)) {
                issues.push(`${getRelativePath(projectRoot, filePath)}:${line}: リンク先がありません: ${target}`);
                continue;
            }

            if (rawAnchor && markdownFileSet.has(targetPath)) {
                const anchor = decodeURIComponent(rawAnchor);

                if (!parsedFiles.get(targetPath).anchors.has(anchor)) {
                    issues.push(`${getRelativePath(projectRoot, filePath)}:${line}: アンカーがありません: ${target}`);
                }
            }

            if (markdownFileSet.has(targetPath)) {
                linkedMarkdownFiles.push(targetPath);
            }
        }

        linkGraph.set(filePath, linkedMarkdownFiles);
    }

    const reachableFiles = new Set();
    const filesToVisit = [docsIndex];

    // docs/index.mdを起点にリンクを辿り、索引から到達できる文書を収集する。
    while (filesToVisit.length > 0) {
        const filePath = filesToVisit.pop();

        if (reachableFiles.has(filePath)) {
            continue;
        }

        reachableFiles.add(filePath);
        filesToVisit.push(...(linkGraph.get(filePath) || []));
    }

    // docs配下の現行文書は、すべて索引から辿れる状態を必須とする。
    for (const filePath of docsMarkdownFiles) {
        if (!reachableFiles.has(filePath)) {
            issues.push(`${getRelativePath(projectRoot, filePath)}: docs/index.md から辿れません。`);
        }
    }

    return issues;
}

module.exports = {
    validateDocumentation
};
