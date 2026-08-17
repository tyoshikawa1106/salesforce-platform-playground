// 実行方法: check-docs.jsとテストスクリプトから読み込む。
// 用途: 文書検証の対象となるMarkdownをリポジトリから抽出する。

const { execFileSync } = require('child_process');
const path = require('path');

// 文書の検出と除外判定に使用するリポジトリ内の基準パス。
const projectRoot = path.resolve(__dirname, '../..');
const docsRoot = path.join(projectRoot, 'docs');
const docsIndex = path.join(docsRoot, 'index.md');
const externalSkillsRoot = path.join(projectRoot, '.agents', 'skills');
const historicalDocumentRoots = [path.join(docsRoot, 'knowledge'), path.join(docsRoot, 'discussions')];
const fragmentMarkdownFiles = [path.join(projectRoot, '.github/pull_request_template.md')];

// 外部取得したSkills文書は取得元を正とし、このリポジトリのdocs検証対象から外す。
function isExternalSkillFile(filePath) {
    return filePath.startsWith(`${externalSkillsRoot}${path.sep}`);
}

// knowledgeとdiscussionsは作成時点の記録であり、現行文書の検証対象から外す。
function isHistoricalDocument(filePath) {
    return historicalDocumentRoots.some((rootPath) => filePath.startsWith(`${rootPath}${path.sep}`));
}

// Git管理対象と未追跡・非除外のMarkdownを列挙し、新規文書も検証対象に含める。
function getManagedMarkdownFiles() {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'], {
        cwd: projectRoot,
        encoding: 'utf8'
    })
        .split('\n')
        .filter(Boolean)
        .map((filePath) => path.join(projectRoot, filePath))
        .filter((filePath) => !isExternalSkillFile(filePath) && !isHistoricalDocument(filePath))
        .sort();
}

// docs配下に置かれた現行文書だけを返す。
function getDocsMarkdownFiles() {
    const docsPrefix = `${docsRoot}${path.sep}`;

    return getManagedMarkdownFiles().filter((filePath) => filePath.startsWith(docsPrefix));
}

// READMEやscriptsガイドなど、docs外で単独文書として管理するMarkdownを返す。
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
