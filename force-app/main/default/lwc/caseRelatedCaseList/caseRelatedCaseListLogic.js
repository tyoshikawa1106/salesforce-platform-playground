import { createLogDetails } from 'c/lwcLoggerUtils';
// 狭いサイドバーで一覧が長くなりすぎないよう表示数を制限
const DISPLAY_LIMIT = 20;
// 参照できない表示値を空欄にせず代替表示
const UNAVAILABLE_VALUE = '-';
// 件名が空のケースを識別できるよう代替表示
const MISSING_SUBJECT = '（件名なし）';

// 単独配置された項目だけを採用し、作成者などの複合表示で日付ラベルを上書きしない
export function getCaseLayoutFields(layout) {
    const fields = {};
    for (const section of layout?.sections ?? []) {
        for (const row of section.layoutRows) {
            for (const item of row.layoutItems) {
                const [component] = item.layoutComponents;
                if (item.layoutComponents.length === 1 && component.componentType === 'Field' && item.label) {
                    fields[component.apiName] = { label: item.label };
                }
            }
        }
    }
    return fields;
}

// UI APIレコードから並び替え用の作成日時を取得
const getCreatedDate = (record) => record?.fields?.CreatedDate?.value || '';

// 作成日時の新しいケースを先に並べる
const compareCreatedDateDescending = (left, right) =>
    getCreatedDate(right).localeCompare(getCreatedDate(left));

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
    caseType,
    createdDate,
    closedDate,
    accountName,
    contactName,
    isCurrentCase = false,
    url,
    accountUrl,
    contactUrl
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
        // 種別を表示し、参照できない場合は代替値を使用
        caseType: caseType || UNAVAILABLE_VALUE,
        // 作成日時を日付表示コンポーネントへ渡す
        createdDate,
        // クローズ日時がある場合だけ日付表示コンポーネントを描画
        hasClosedDate: Boolean(closedDate),
        // クローズ日時を日付表示コンポーネントへ渡す
        closedDate,
        // クローズ日時がない場合の代替表示
        closedDateText: UNAVAILABLE_VALUE,
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
        // 現在表示中のCaseへ識別バッジを描画する状態
        isCurrentCase,
        // URLがある場合だけテンプレートでアンカーを描画
        hasUrl: Boolean(url),
        // URL生成に失敗した場合はリンクなしとして保持
        url
    };
}
// エラー本文を使わず、画面名・固定の処理名・例外種別だけを診断用に生成
export function clientErrorDetails(error, operation, phase) {
    // 例外の種類とSalesforce応答形式の判定はこの画面で管理
    const errorType = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name)
        ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // 判定済みの種類と固定位置だけを共通のログ整形へ渡す
    return createLogDetails({ source: 'caseRelatedCaseList.js', operation, phase, errorType, stack: error?.stack });
}