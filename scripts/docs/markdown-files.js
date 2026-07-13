const { execFileSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const docsRoot = path.join(projectRoot, 'docs');
const docsIndex = path.join(docsRoot, 'index.md');
const fragmentMarkdownFiles = [path.join(projectRoot, '.github/pull_request_template.md')];

function getManagedMarkdownFiles() {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'], {
        cwd: projectRoot,
        encoding: 'utf8'
    })
        .split('\n')
        .filter(Boolean)
        .map((filePath) => path.join(projectRoot, filePath))
        .sort();
}

function getDocsMarkdownFiles() {
    const docsPrefix = `${docsRoot}${path.sep}`;

    return getManagedMarkdownFiles().filter((filePath) => filePath.startsWith(docsPrefix));
}

function getAdditionalDocumentMarkdownFiles() {
    const docsPrefix = `${docsRoot}${path.sep}`;
    const fragmentMarkdownFileSet = new Set(fragmentMarkdownFiles);

    return getManagedMarkdownFiles().filter(
        (filePath) => !filePath.startsWith(docsPrefix) && !fragmentMarkdownFileSet.has(filePath)
    );
}

module.exports = {
    docsIndex,
    docsRoot,
    fragmentMarkdownFiles,
    getAdditionalDocumentMarkdownFiles,
    getDocsMarkdownFiles,
    getManagedMarkdownFiles,
    projectRoot
};
