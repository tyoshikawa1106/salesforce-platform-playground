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
    // 全検証を最後まで続け、利用者が一度に修正できる問題一覧を作る。
    const issues = [];
    // 参照頻度の高い対象一覧はSetへ変換し、ファイルごとの判定を一定時間にする。
    const fragmentMarkdownFileSet = new Set(fragmentMarkdownFiles);
    // ローカルリンク先が管理対象かを一定時間で判定できるSetを作る。
    const markdownFileSet = new Set(markdownFiles);
    // 解析結果とリンク関係を再利用し、同じMarkdownを繰り返し読まない。
    const parsedFiles = new Map();
    // 索引到達性の探索に使用する文書間リンクを保持する。
    const linkGraph = new Map();

    // ファイル名ルールはdocs配下だけに適用する。
    for (const filePath of docsMarkdownFiles) {
        // 各ファイルの問題を共通一覧へ追加し、途中で検証を打ち切らない。
        issues.push(...validateFileName(filePath, projectRoot));
    }

    // 先に全Markdownを解析し、後続のファイル間リンク検証に利用する。
    for (const filePath of markdownFiles) {
        // ファイル内容は呼び出し元から注入し、テストで実ファイル依存を避ける。
        const content = readFile(filePath);
        // 文書断片以外は現行文書としてH1を必須にする。
        const parsed = parseMarkdown({
            content,
            filePath,
            projectRoot,
            requireH1: !fragmentMarkdownFileSet.has(filePath)
        });

        // 後続のリンク先アンカー検証へ解析結果を引き渡す。
        parsedFiles.set(filePath, parsed);
        // Markdown単体の構造問題を全体の問題一覧へ追加する。
        issues.push(...parsed.issues);
        // 文書中の安全でないコマンド例も同じ問題一覧へ追加する。
        issues.push(...validateUnsafeCommandExamples({ content, filePath, projectRoot }));
    }

    // ローカルリンクのファイルとアンカーを確認し、文書間のリンクグラフを作る。
    for (const filePath of markdownFiles) {
        // 現在の文書から直接辿れるMarkdownだけを到達性グラフへ登録する。
        const linkedMarkdownFiles = [];

        // 解析済みのローカルリンクを1件ずつ実ファイルと照合する。
        for (const { line, target } of parsedFiles.get(filePath).localLinks) {
            // URL片をファイルパスとアンカーに分け、相対パスを実ファイルへ解決する。
            const [rawPath, rawAnchor] = target.split('#', 2);
            // パス省略時は同じ文書、指定時はリンク元基準の絶対パスへ変換する。
            const targetPath = rawPath ? path.resolve(path.dirname(filePath), decodeURIComponent(rawPath)) : filePath;

            // 存在しないリンク先はアンカー確認へ進まず、元の記述位置を報告する。
            if (!fileExists(targetPath)) {
                // 利用者が修正できるようリンク元の行番号と指定値を記録する。
                issues.push(`${getRelativePath(projectRoot, filePath)}:${line}: リンク先がありません: ${target}`);
                // 存在しないファイルではアンカーと到達性の判定を行わない。
                continue;
            }

            // 管理対象Markdownへのリンクだけ、解析済みアンカーと照合する。
            if (rawAnchor && markdownFileSet.has(targetPath)) {
                // URL encoded文字を戻し、解析済みアンカーと同じ形式に揃える。
                const anchor = decodeURIComponent(rawAnchor);

                // リンク先文書に該当アンカーが登録されているか確認する。
                if (!parsedFiles.get(targetPath).anchors.has(anchor)) {
                    // 存在しないアンカーをリンク元の行番号付きで記録する。
                    issues.push(`${getRelativePath(projectRoot, filePath)}:${line}: アンカーがありません: ${target}`);
                }
            }

            // Markdown間のリンクだけを索引到達性の辺として保持する。
            if (markdownFileSet.has(targetPath)) {
                // 現在の文書から直接辿れるリンク先として追加する。
                linkedMarkdownFiles.push(targetPath);
            }
        }

        // 現在の文書と直接リンク先の対応を探索用graphへ登録する。
        linkGraph.set(filePath, linkedMarkdownFiles);
    }

    // 索引から探索済みの文書を保持し、循環リンクでも無限に辿らない。
    const reachableFiles = new Set();
    // 深さ優先で辿る未処理ファイルを索引から開始する。
    const filesToVisit = [docsIndex];

    // docs/index.mdを起点にリンクを辿り、索引から到達できる文書を収集する。
    while (filesToVisit.length > 0) {
        // 未処理スタックの末尾から1件ずつ取り出す。
        const filePath = filesToVisit.pop();

        // すでに探索済みの文書は循環リンクから再処理しない。
        if (reachableFiles.has(filePath)) {
            // 次の未処理文書へ進む。
            continue;
        }

        // 初回訪問時だけ到達済みにし、直接リンクされた文書を次の候補へ追加する。
        reachableFiles.add(filePath);
        // リンクが登録されていない文書は空配列として探索を継続する。
        filesToVisit.push(...(linkGraph.get(filePath) || []));
    }

    // docs配下の現行文書は、すべて索引から辿れる状態を必須とする。
    for (const filePath of docsMarkdownFiles) {
        // 索引から探索できなかった現行文書を問題として扱う。
        if (!reachableFiles.has(filePath)) {
            // 修正対象を特定できるリポジトリ相対パスを記録する。
            issues.push(`${getRelativePath(projectRoot, filePath)}: docs/index.md から辿れません。`);
        }
    }

    // 全検証で収集した問題を呼び出し元へまとめて返す。
    return issues;
}

module.exports = {
    validateDocumentation
};
