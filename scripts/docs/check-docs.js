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

if (issues.length > 0) {
    console.error(`Docs check failed with ${issues.length} issue(s):`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
} else {
    console.log(
        `Docs check passed: ${docsMarkdownFiles.length} docs files, ${additionalDocumentMarkdownFiles.length} additional documents, and ${fragmentMarkdownFiles.length} fragment.`
    );
}
