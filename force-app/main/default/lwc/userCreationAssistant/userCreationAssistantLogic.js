// 同姓同名でも参照元を特定できる項目を表示順に定義
const SOURCE_FIELDS = [
    ['Name', '氏名'],
    ['Username', 'ユーザー名'],
    ['Email', 'メール']
];

// 現在選択され、参照が許可された項目だけを表示行に変換
export function getSourceRows(sourceId, record) {
    // 参照元の切り替え中は直前の利用者情報を隠す
    if (!sourceId || record?.id !== sourceId) {
        // 選択に対応する応答を受け取るまで待機
        return [];
    }
    // 取得対象外と値が未設定の項目を区別
    return SOURCE_FIELDS.filter(([name]) => record.fields[name]).map(([name, label]) => ({
        name,
        label,
        value: record.fields[name].value || '—'
    }));
}
