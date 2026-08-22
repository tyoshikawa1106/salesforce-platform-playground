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
    // OS固有区切りをslashへ変換し、検証メッセージを同じ表記に揃える。
    return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

// GitHub Markdownと同じ形式で見出しアンカーを作り、同名見出しには連番を付ける。
function createHeadingAnchor(heading, anchorCounts) {
    // GitHubの見出し正規化順に、装飾、空白、記号を取り除く。
    const baseAnchor = heading
        .toLowerCase()
        .replace(/[`*_~]/g, '')
        .trim()
        .replace(/\s/g, '-')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s/g, '');
    // 同名見出しの出現回数を、次に付与するsuffixとして使用する。
    const count = anchorCounts.get(baseAnchor) || 0;

    // 今回の見出しを数えた状態へ更新する。
    anchorCounts.set(baseAnchor, count + 1);
    // 最初の見出しにはsuffixを付けず、2件目以降へ0始まりの連番を付ける。
    return count === 0 ? baseAnchor : `${baseAnchor}-${count}`;
}

// 1つのMarkdownから、見出し、ローカルリンク、構造上の問題を収集する。
function parseMarkdown({ content, filePath, projectRoot, requireH1 }) {
    // 元の行番号を維持したまま、Markdownを1行ずつ解析する。
    const lines = content.split('\n');
    // 同名見出しの連番と、リンク検証用のアンカー一覧を別々に保持する。
    const anchors = new Set();
    // アンカーごとの出現回数を保持し、重複suffixを決定する。
    const anchorCounts = new Map();
    // 構造問題とローカルリンクを呼び出し元でまとめて検証できる形にする。
    const issues = [];
    // 全ファイル解析後に存在確認するローカルリンクを保持する。
    const localLinks = [];
    // コード例を文書構造から除外するため、開いているフェンス種別を追跡する。
    let fenceMarker = null;
    // H1件数と直前の見出しレベルを、文書全体を通した構造判定に使用する。
    let h1Count = 0;
    // 次の見出しが複数段飛んでいないか確認するため直前レベルを保持する。
    let previousHeadingLevel = 0;

    // 各行の元のindexを行番号へ利用しながら文書構造を収集する。
    lines.forEach((line, index) => {
        // コードフェンス内の見出しやリンク例を文書構造として扱わない。
        const fenceMatch = line.trimStart().match(/^(```+|~~~+)/);

        // フェンス行では構造解析をせず、コードブロック状態だけを更新する。
        if (fenceMatch) {
            // 開始と同種のmarkerを終了として扱い、フェンス内外を切り替える。
            if (fenceMarker === null) {
                // 開始markerの文字種を後続行の終了判定へ保持する。
                fenceMarker = fenceMatch[1][0];
            } else if (fenceMarker === fenceMatch[1][0]) {
                // 同じ文字種の終了markerでコードブロック外へ戻す。
                fenceMarker = null;
            }
            // フェンス行自体を見出しやリンクとして解析しない。
            return;
        }

        // コードブロック内の例示は文書構造として解析しない。
        if (fenceMarker !== null) {
            // 次の行までフェンス状態を維持して処理を終了する。
            return;
        }

        // 現在行がMarkdown見出しかを先頭の#で判定する。
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

        // 見出しの場合だけレベル、H1件数、アンカーを更新する。
        if (headingMatch) {
            // #の数を見出しレベルとして構造判定へ使用する。
            const headingLevel = headingMatch[1].length;

            // 文書内でH1がちょうど1件かを最後に確認できるよう数える。
            if (headingLevel === 1) {
                // H1を1件検出した状態へ件数を更新する。
                h1Count += 1;
            }

            // 見出しレベルが飛ぶと文書構造を追いにくいため問題として報告する。
            if (previousHeadingLevel > 0 && headingLevel > previousHeadingLevel + 1) {
                // 遷移元と遷移先のレベルを行番号付きで問題一覧へ追加する。
                issues.push(
                    `${getRelativePath(projectRoot, filePath)}:${index + 1}: 見出しが H${previousHeadingLevel} から H${headingLevel} へ飛んでいます。`
                );
            }

            // 次の見出しとのレベル差を確認できるよう現在値を保持する。
            previousHeadingLevel = headingLevel;
            // ローカルリンクの照合に使うGitHub形式アンカーを登録する。
            anchors.add(createHeadingAnchor(headingMatch[2], anchorCounts));
        }

        // Markdownのインラインリンクからリンク先部分だけを順番に抽出する。
        const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
        // 同じ行に複数あるリンクを順番に保持する変数を用意する。
        let linkMatch;

        // 現在行から未処理のリンクが見つかる間は抽出を続ける。
        while ((linkMatch = linkPattern.exec(line)) !== null) {
            // 前後空白を除いたリンク先を検証用の値として保持する。
            let target = linkMatch[1].trim();

            // 山括弧で囲まれた空白入りリンク先は、囲みを外して正規化する。
            if (target.startsWith('<') && target.endsWith('>')) {
                // Markdownの囲みだけを除き内部のパスを維持する。
                target = target.slice(1, -1);
            }

            // 外部URLとメールリンクはローカルファイル検証の対象外にする。
            if (/^(https?:|mailto:)/.test(target)) {
                // 次のリンク候補へ進み、外部URLの存在確認は行わない。
                continue;
            }

            // 存在確認とアンカー確認は全ファイルの解析後にまとめて行う。
            localLinks.push({ line: index + 1, target });
        }
    });

    // 通常文書では文書タイトルとなるH1を1件だけ必須にする。
    if (requireH1 && h1Count !== 1) {
        // 実際のH1件数を含め、追加または削除が必要なことを記録する。
        issues.push(`${getRelativePath(projectRoot, filePath)}: H1 は1つ必要です。現在は ${h1Count} 個です。`);
    }

    // ファイル間検証に必要なアンカー、問題、リンクをまとめて返す。
    return { anchors, issues, localLinks };
}

// docs配下のMarkdownファイル名をindexまたはkebab-caseへ統一する。
function validateFileName(filePath, projectRoot) {
    // 拡張子を除いた名前だけを命名規則と照合する。
    const fileName = path.basename(filePath, '.md');

    // indexまたはkebab-caseなら命名上の問題なしと判定する。
    if (fileName === 'index' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fileName)) {
        // 問題一覧を空のまま返す。
        return [];
    }

    // 命名規則に合わないファイルの相対パスを問題として返す。
    return [`${getRelativePath(projectRoot, filePath)}: ファイル名を kebab-case にしてください。`];
}

// コードフェンスの開始・終了を判定し、次の行で使用するmarkerを返す。
function getNextFenceMarker(line, currentMarker) {
    // 3文字以上のbacktickまたはtildeだけをフェンスとして認識する。
    const marker = line.trimStart().match(/^(```+|~~~+)/)?.[1];

    // フェンス行でなければ現在の状態をそのまま次行へ渡す。
    if (!marker) {
        // 呼び出し元が現在行を通常内容として解析できる状態を返す。
        return { isFenceLine: false, marker: currentMarker };
    }

    // フェンス外でmarkerを検出した場合は新しいコードブロックを開始する。
    if (currentMarker === null) {
        // 開始markerを次行以降の終了判定へ引き渡す。
        return { isFenceLine: true, marker };
    }

    // 開始marker以上の長さを持つ同種markerだけを終了フェンスとして扱う。
    const closesFence = currentMarker[0] === marker[0] && marker.length >= currentMarker.length;
    // 終了時はmarkerを解除し、それ以外は現在のフェンスを維持する。
    return { isFenceLine: true, marker: closesFence ? null : currentMarker };
}

// コード例の行からshell promptとインデントを除いたコマンドを取得する。
function getCodeExampleCommand(line, fenceMarker) {
    // フェンス外ではMarkdownの4-spaceまたはtabインデントもコード例として扱う。
    const isIndentedCode = /^(?: {4}|\t)/.test(line);

    // 通常の説明行はコマンドルールへ渡さない。
    if (fenceMarker === null && !isIndentedCode) {
        // コマンド例ではないことをnullで呼び出し元へ伝える。
        return null;
    }

    // インデントと代表的なshell promptを除き、実際のコマンド部分へ揃える。
    return line
        .replace(/^(?: {4}|\t)/, '')
        .trimStart()
        .replace(/^(?:PS(?:\s+[^>]*)?>|[A-Z]:\\[^>]*>|\$)\s*/i, '');
}

// 1行の内容に一致するルールを、行番号付きの問題へ変換する。
function collectRuleIssues({ filePath, index, projectRoot, rules, value }) {
    // 一致した全ルールを、修正位置を特定できるメッセージへ変換する。
    return rules
        .filter(({ pattern }) => pattern.test(value))
        .map(({ message }) => `${getRelativePath(projectRoot, filePath)}:${index + 1}: ${message}`);
}

// 端末環境や他ツールまで広く変更する危険なコマンド例が文書にないか確認する。
function validateUnsafeCommandExamples({ content, filePath, projectRoot }) {
    // 1ファイル内の違反をすべて収集し、最初の一致だけで終了しない。
    const issues = [];
    // コマンド限定ルールの適用範囲を判定するためフェンス状態を保持する。
    let fenceMarker = null;

    // 元の行番号を維持したまま全行の安全性を確認する。
    content.split('\n').forEach((line, index) => {
        // 記述場所に依存しない危険な文字列は全行で確認する。
        issues.push(...collectRuleIssues({ filePath, index, projectRoot, rules: unsafeLineRules, value: line }));

        // 現在行を反映したフェンス状態を次行へ引き渡す。
        const fence = getNextFenceMarker(line, fenceMarker);
        // 次の行のコマンド判定に使用する現在のmarkerへ更新する。
        fenceMarker = fence.marker;

        // フェンス自体はコマンドとして評価しない。
        if (fence.isFenceLine) {
            // 次の文書行へ進む。
            return;
        }

        // コード例の場合だけpromptを除いたコマンドを取り出す。
        const command = getCodeExampleCommand(line, fenceMarker);

        // 説明文でコマンド名に言及しただけの場合は実行例として扱わない。
        if (command === null) {
            // コマンドルールを適用せず次の文書行へ進む。
            return;
        }

        // 安全でない実行例に一致した全ルールを問題一覧へ追加する。
        issues.push(...collectRuleIssues({ filePath, index, projectRoot, rules: unsafeCommandRules, value: command }));
    });

    // 全行から収集した安全性の問題を呼び出し元へ返す。
    return issues;
}

module.exports = {
    createHeadingAnchor,
    getRelativePath,
    parseMarkdown,
    validateFileName,
    validateUnsafeCommandExamples
};
