// 実行コマンド: npm run docs:check
// 用途: Git管理対象と未追跡・非除外のMarkdownを検査し、見つかった問題をまとめて表示する。

const fs = require('fs');
const {
    docsIndex,
    fragmentMarkdownFiles,
    getAdditionalDocumentMarkdownFiles,
    getDocsMarkdownFiles,
    getManagedMarkdownFiles,
    projectRoot
} = require('./internal/markdown-files');
const { validateDocumentation } = require('./internal/validate-docs');

// 文書断片を含む、構造とリンクを検証する全Markdownを列挙する。
const markdownFiles = getManagedMarkdownFiles();
// 同じ対象一覧から、docs配下の現行文書を索引到達性と件数表示の対象へ分類する。
const docsMarkdownFiles = getDocsMarkdownFiles(markdownFiles);
// 同じ対象一覧から、READMEなどdocs外で管理する単独文書を別区分へ分類する。
const additionalDocumentMarkdownFiles = getAdditionalDocumentMarkdownFiles(markdownFiles);
// 同じ対象一覧と読み込み方法を検証処理へ渡し、問題を一括収集する。
const issues = validateDocumentation({
    docsIndex,
    docsMarkdownFiles,
    fileExists: fs.existsSync,
    fragmentMarkdownFiles,
    markdownFiles,
    projectRoot,
    readFile(filePath) {
        // Markdownは行番号が変わらないUTF-8文字列として読み込む。
        return fs.readFileSync(filePath, 'utf8');
    }
});

// すべての問題を一度に表示し、修正後の再実行回数を減らす。
if (issues.length > 0) {
    // CIログの先頭で、検出した問題の総数を明示する。
    console.error(`エラー: 文書検証で${issues.length}件の問題が見つかりました。`);
    // 修正場所をまとめて確認できるよう、全問題を省略せず表示する。
    issues.forEach((issue) => console.error(`- ${issue}`));
    // 問題を表示したうえで、呼び出し元へ失敗を返す。
    process.exitCode = 1;
} else {
    // 検証対象の内訳を表示し、意図しない対象漏れを見つけやすくする。
    console.log(
        `文書検証に成功しました: docs ${docsMarkdownFiles.length}件、docs外 ${additionalDocumentMarkdownFiles.length}件、文書断片 ${fragmentMarkdownFiles.length}件。`
    );
}
