// 実行方法: check-docs.jsとテストスクリプトから読み込む。
// 用途: 文書検証の対象となるMarkdownをリポジトリから抽出する。

const { execFileSync } = require('child_process');
const path = require('path');

// 文書の検出と除外判定に使用するリポジトリ内の基準パス。
const projectRoot = path.resolve(__dirname, '../../..');
// docs配下の判定と索引の起点に使用する絶対パスを保持する。
const docsRoot = path.join(projectRoot, 'docs');
const docsIndex = path.join(docsRoot, 'index.md');
// 外部取得物はリポジトリ独自文書と分離して検証対象外にする。
const externalSkillsRoot = path.join(projectRoot, '.agents', 'skills');
// 作成時点の記録は現行文書の到達性検証から除外する。
const historicalDocumentRoots = [path.join(docsRoot, 'knowledge'), path.join(docsRoot, 'discussions')];
// H1を要求しない再利用用Markdown断片を明示する。
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
    // 文字列の前方一致で隣接名を誤検出しないよう区切り文字まで含める。
    const docsPrefix = `${docsRoot}${path.sep}`;

    return getManagedMarkdownFiles().filter((filePath) => filePath.startsWith(docsPrefix));
}

// READMEやscriptsガイドなど、docs外で単独文書として管理するMarkdownを返す。
function getAdditionalDocumentMarkdownFiles() {
    // docs配下と文書断片を除いた残りを単独文書として扱う。
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
