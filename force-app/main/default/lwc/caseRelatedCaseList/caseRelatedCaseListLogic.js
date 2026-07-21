// 狭いサイドバーで一覧が長くなりすぎないよう表示数を制限
const DISPLAY_LIMIT = 20;
// 参照できない表示値を空欄にせず代替表示
const UNAVAILABLE_VALUE = '-';
// 件名が空のケースを識別できるよう代替表示
const MISSING_SUBJECT = '（件名なし）';
// 経過日数を算出する1日分のミリ秒
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// UI APIレコードから並び替え用の作成日時を取得
const getCreatedDate = (record) => record?.fields?.CreatedDate?.value || '';

// 作成日時の新しいケースを先に並べる
const compareCreatedDateDescending = (left, right) =>
    getCreatedDate(right).localeCompare(getCreatedDate(left));

// オープンからクローズまたは現在までの経過日数を表示値へ変換
export function formatCaseDays(createdDate, closedDate, now = Date.now()) {
    // オープン日時を日数計算可能な値へ変換
    const openedAt = Date.parse(createdDate);
    // クローズ済みはクローズ日時、未クローズは現在日時を終点に使用
    const endedAt = closedDate ? Date.parse(closedDate) : now;

    // 日付を取得できない場合は代替表示を返却
    if (!Number.isFinite(openedAt) || !Number.isFinite(endedAt)) {
        return UNAVAILABLE_VALUE;
    }

    // 同日または将来日時の揺れを0日として扱い、経過日数を返却
    return `${Math.max(
        0,
        Math.floor((endedAt - openedAt) / MILLISECONDS_PER_DAY)
    )}日`;
}

// 表示中Caseを含めて作成日時順にカード変換対象を選別
export function selectRelatedCaseRecords(records = [], currentRecord) {
    // 関連リスト側の表示中Caseを除き、別Caseを作成日時の降順に並べる
    const otherRecords = records
        .filter((record) => record.id !== currentRecord?.id)
        .sort(compareCreatedDateDescending);

    // 表示中Caseを必ず含めるため、別Caseに割り当てる最大件数を調整
    const otherRecordLimit = currentRecord
        ? DISPLAY_LIMIT - 1
        : DISPLAY_LIMIT;

    // 表示中Caseを含む最大20件を作成日時の降順で返却
    return [
        ...otherRecords.slice(0, otherRecordLimit),
        ...(currentRecord ? [currentRecord] : [])
    ].sort(compareCreatedDateDescending);
}

// UI APIから抽出した値をテンプレート用カードへ正規化
export function createCaseCard({
    id,
    caseNumber,
    subject,
    status,
    reason,
    createdDate,
    closedDate,
    accountName,
    contactName,
    ownerName,
    isCurrentCase = false,
    url,
    accountUrl,
    contactUrl,
    now
}) {
    // 表示、リンク、代替値を含むカード状態を返却
    return {
        // 繰り返し描画のキーにCase IDを使用
        id,
        // ケース番号をカードのリンクラベルとして表示
        caseNumber: caseNumber || UNAVAILABLE_VALUE,
        // 件名未入力時もカードの内容を識別可能にする
        subject: subject || MISSING_SUBJECT,
        // 状況を表示し、参照できない場合は代替値を使用
        status: status || UNAVAILABLE_VALUE,
        // 原因を表示し、参照できない場合は代替値を使用
        reason: reason || UNAVAILABLE_VALUE,
        // 作成日時を日付表示コンポーネントへ渡す
        createdDate,
        // クローズ日時がある場合だけ日付表示コンポーネントを描画
        hasClosedDate: Boolean(closedDate),
        // クローズ日時を日付表示コンポーネントへ渡す
        closedDate,
        // クローズ日時がない場合の代替表示
        closedDateText: UNAVAILABLE_VALUE,
        // オープンからクローズまたは現在までの経過日数を表示
        caseDays: formatCaseDays(createdDate, closedDate, now),
        // 取引先名を表示し、参照できない場合は代替値を使用
        accountName: accountName || UNAVAILABLE_VALUE,
        // 取引先名とURLがある場合だけアンカーを描画
        hasAccountUrl: Boolean(accountName && accountUrl),
        // 取引先レコードURLを保持
        accountUrl,
        // 取引先責任者名を表示し、参照できない場合は代替値を使用
        contactName: contactName || UNAVAILABLE_VALUE,
        // 取引先責任者名とURLがある場合だけアンカーを描画
        hasContactUrl: Boolean(contactName && contactUrl),
        // 取引先責任者レコードURLを保持
        contactUrl,
        // 所有者名を表示し、参照できない場合は代替値を使用
        ownerName: ownerName || UNAVAILABLE_VALUE,
        // 現在表示中のCaseへ識別バッジを描画する状態
        isCurrentCase,
        // URLがある場合だけテンプレートでアンカーを描画
        hasUrl: Boolean(url),
        // URL生成に失敗した場合はリンクなしとして保持
        url
    };
}
