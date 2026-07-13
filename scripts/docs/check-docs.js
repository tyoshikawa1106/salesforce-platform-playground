const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const docsRoot = path.join(projectRoot, 'docs');
const docsIndex = path.join(docsRoot, 'index.md');
const additionalMarkdownFiles = [
    path.join(projectRoot, 'README.md'),
    path.join(projectRoot, 'AGENTS.md'),
    path.join(projectRoot, 'CLAUDE.md'),
    path.join(projectRoot, 'GEMINI.md'),
    path.join(projectRoot, '.github/copilot-instructions.md'),
    path.join(projectRoot, 'export-out/export-out-guide.md'),
    path.join(projectRoot, 'logs/apex/apex-log-guide.md'),
    path.join(projectRoot, 'logs/code-analyzer/code-analyzer-guide.md'),
    path.join(projectRoot, 'logs/data-bulk-results/bulk-results-guide.md'),
    path.join(projectRoot, 'scripts/scripts-guide.md')
];
const issues = [];

function listMarkdownFiles(directory) {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const entryPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                return listMarkdownFiles(entryPath);
            }

            return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
        })
        .sort();
}

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

function parseMarkdown(filePath) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const anchors = new Set();
    const anchorCounts = new Map();
    const localLinks = [];
    let inFence = false;
    let h1Count = 0;
    let previousHeadingLevel = 0;

    lines.forEach((line, index) => {
        if (line.trimStart().startsWith('```')) {
            inFence = !inFence;
            return;
        }

        if (inFence) {
            return;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

        if (headingMatch) {
            const headingLevel = headingMatch[1].length;

            if (headingLevel === 1) {
                h1Count += 1;
            }

            if (previousHeadingLevel > 0 && headingLevel > previousHeadingLevel + 1) {
                issues.push(
                    `${path.relative(projectRoot, filePath)}:${index + 1}: 見出しが H${previousHeadingLevel} から H${headingLevel} へ飛んでいます。`
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

            localLinks.push({ line: index + 1, target });
        }
    });

    if (h1Count !== 1) {
        issues.push(`${path.relative(projectRoot, filePath)}: H1 は1つ必要です。現在は ${h1Count} 個です。`);
    }

    return { anchors, localLinks };
}

function validateFileName(filePath) {
    const fileName = path.basename(filePath, '.md');

    if (fileName !== 'index' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fileName)) {
        issues.push(`${path.relative(projectRoot, filePath)}: ファイル名を kebab-case にしてください。`);
    }
}

const docsMarkdownFiles = listMarkdownFiles(docsRoot);
const markdownFiles = [...docsMarkdownFiles, ...additionalMarkdownFiles];
const markdownFileSet = new Set(markdownFiles);
const parsedFiles = new Map();
const linkGraph = new Map();

docsMarkdownFiles.forEach((filePath) => {
    validateFileName(filePath);
});

markdownFiles.forEach((filePath) => {
    parsedFiles.set(filePath, parseMarkdown(filePath));
});

markdownFiles.forEach((filePath) => {
    const linkedMarkdownFiles = [];

    parsedFiles.get(filePath).localLinks.forEach(({ line, target }) => {
        const [rawPath, rawAnchor] = target.split('#', 2);
        const targetPath = rawPath ? path.resolve(path.dirname(filePath), decodeURIComponent(rawPath)) : filePath;

        if (!fs.existsSync(targetPath)) {
            issues.push(`${path.relative(projectRoot, filePath)}:${line}: リンク先がありません: ${target}`);
            return;
        }

        if (rawAnchor && markdownFileSet.has(targetPath)) {
            const anchor = decodeURIComponent(rawAnchor);

            if (!parsedFiles.get(targetPath).anchors.has(anchor)) {
                issues.push(`${path.relative(projectRoot, filePath)}:${line}: アンカーがありません: ${target}`);
            }
        }

        if (markdownFileSet.has(targetPath)) {
            linkedMarkdownFiles.push(targetPath);
        }
    });

    linkGraph.set(filePath, linkedMarkdownFiles);
});

const reachableFiles = new Set();
const filesToVisit = [docsIndex];

while (filesToVisit.length > 0) {
    const filePath = filesToVisit.pop();

    if (reachableFiles.has(filePath)) {
        continue;
    }

    reachableFiles.add(filePath);
    filesToVisit.push(...(linkGraph.get(filePath) || []));
}

docsMarkdownFiles.forEach((filePath) => {
    if (!reachableFiles.has(filePath)) {
        issues.push(`${path.relative(projectRoot, filePath)}: docs/index.md から辿れません。`);
    }
});

if (issues.length > 0) {
    console.error(`Docs check failed with ${issues.length} issue(s):`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
} else {
    console.log(
        `Docs check passed: ${docsMarkdownFiles.length} docs files and ${additionalMarkdownFiles.length} additional files.`
    );
}
