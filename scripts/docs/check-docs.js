#!/usr/bin/env node

const fs = require('fs');
const {
    docsIndex,
    fragmentMarkdownFiles,
    getAdditionalDocumentMarkdownFiles,
    getDocsMarkdownFiles,
    getManagedMarkdownFiles,
    projectRoot
} = require('./markdown-files');
const { validateDocumentation } = require('./check-docs-core');

// 文書の配置区分ごとに対象を列挙し、同じ一覧を検証と件数表示に使用する。
const docsMarkdownFiles = getDocsMarkdownFiles();
const additionalDocumentMarkdownFiles = getAdditionalDocumentMarkdownFiles();
const markdownFiles = getManagedMarkdownFiles();
const issues = validateDocumentation({
    docsIndex,
    docsMarkdownFiles,
    fileExists: fs.existsSync,
    fragmentMarkdownFiles,
    markdownFiles,
    projectRoot,
    readFile(filePath) {
        return fs.readFileSync(filePath, 'utf8');
    }
});

// すべての問題を一度に表示し、修正後の再実行回数を減らす。
if (issues.length > 0) {
    console.error(`Docs check failed with ${issues.length} issue(s):`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
} else {
    // 検証対象の内訳を表示し、意図しない対象漏れを見つけやすくする。
    console.log(
        `Docs check passed: ${docsMarkdownFiles.length} docs files, ${additionalDocumentMarkdownFiles.length} additional documents, and ${fragmentMarkdownFiles.length} fragment.`
    );
}
