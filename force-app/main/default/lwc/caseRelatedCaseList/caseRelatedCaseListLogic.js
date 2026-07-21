// 狭いサイドバーで一覧が長くなりすぎないよう表示数を制限
const DISPLAY_LIMIT = 5;
// 参照できない表示値を空欄にせず代替表示
const UNAVAILABLE_VALUE = '-';
// 件名が空のケースを識別できるよう代替表示
const MISSING_SUBJECT = '（件名なし）';

// 表示中Caseを先頭に置いてカード変換対象を選別
export function selectRelatedCaseRecords(records = [], currentRecord) {
    // 関連リスト側の重複を除き、表示中Caseと直近の別Caseを最大件数へまとめる
    const otherRecords = records.filter(
        (record) => record.id !== currentRecord?.id
    );

    // 表示中Caseを取得できた場合はリンクなしカード用に必ず先頭へ含める
    return [...(currentRecord ? [currentRecord] : []), ...otherRecords].slice(
        0,
        DISPLAY_LIMIT
    );
}

// UI APIから抽出した値をテンプレート用カードへ正規化
export function createCaseCard({
    id,
    caseNumber,
    subject,
    status,
    lastModifiedDate,
    url
}) {
    // 表示、リンク、代替値を含むカード状態を返却
    return {
        // 繰り返し描画のキーにCase IDを使用
        id,
        // ケース番号をカードのリンクラベルとして表示
        caseNumber: caseNumber || UNAVAILABLE_VALUE,
        // 件名未入力時もカードの内容を識別可能にする
        subject: subject || MISSING_SUBJECT,
        // 状況を参照できない場合は代替値を表示
        status: status || UNAVAILABLE_VALUE,
        // 最終更新日時を日付表示コンポーネントへ渡す
        lastModifiedDate,
        // URLがある場合だけテンプレートでアンカーを描画
        hasUrl: Boolean(url),
        // URL生成に失敗した場合はリンクなしとして保持
        url
    };
}
