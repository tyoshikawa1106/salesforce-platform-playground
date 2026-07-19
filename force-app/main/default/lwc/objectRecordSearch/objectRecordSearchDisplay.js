// Name相当項目をSalesforceレコードリンクとして表示する基本列
const BASE_NAME_COLUMN = {
    // 呼び出し側で上書きする既定ラベルを設定
    label: 'Name',
    // Wrapperが返すレコードURLをリンク先に使用
    fieldName: 'recordUrl',
    // datatableへURL列として描画させる
    type: 'url',
    // Name相当項目によるサーバーソートを許可
    sortable: true,
    // URLの表示文言と遷移先を指定
    typeAttributes: {
        // Wrapperの表示名をリンクラベルに使用
        label: { fieldName: 'name' },
        // Lightning画面内で同一タブ遷移
        target: '_self'
    }
};

// 追加表示項目を行オブジェクトへ格納する際の接頭辞
const DISPLAY_FIELD_PREFIX = 'displayField_';
// 編集可能な行へ表示する操作メニュー
const ROW_ACTIONS = [{ label: '編集', name: 'edit' }];

// 検索設定と権限状態からdatatable列を生成
export function createColumns({
    nameFieldLabel = 'Name',
    displayFields = [],
    editDisabled = true
} = {}) {
    // Name列と参照可能な追加項目を表示順に構築
    const columns = [
        // Name列の基本定義へ対象オブジェクトの表示情報を反映
        {
            ...BASE_NAME_COLUMN,
            // Name相当項目のSalesforceラベルを表示
            label: nameFieldLabel,
            // 主要列を読みやすい初期幅に設定
            initialWidth: 220
        },
        // 追加表示項目をdatatable列定義へ変換
        ...displayFields.map((field) => createDisplayFieldColumn(field))
    ];

    // 編集可能な場合だけ行操作列を追加
    if (!editDisabled) {
        // 行末へ編集アクションを表示
        columns.push({
            // datatable標準のアクション列を使用
            type: 'action',
            // 利用可能な行操作を設定
            typeAttributes: { rowActions: ROW_ACTIONS }
        });
    }

    // テンプレートへ渡す完成済み列定義を返却
    return columns;
}

// Apex Wrapperの行をdatatable表示用の平坦な行へ変換
export function createDisplayRow(record, displayFields = []) {
    // 追加表示項目を格納する平坦な値Mapを初期化
    const displayValues = {};
    // 項目値未返却時も空Mapとして処理
    const fieldValues = record.fieldValues ?? {};
    // 表示対象項目だけをdatatable用キーへ変換
    displayFields.forEach((field) => {
        // null値を空文字へ変換してセル表示を安定化
        displayValues[getDisplayFieldName(field.apiName)] =
            fieldValues[field.apiName] ?? '';
    });

    // Wrapper本体へ平坦化した表示値を追加
    return {
        ...record,
        ...displayValues
    };
}

// datatable列キーをApex検索で許可された項目API名へ変換
export function getSortFieldApiName({
    sortedBy,
    nameFieldApiName = 'Name'
} = {}) {
    // Nameリンク列は対象オブジェクトのName相当項目へ変換
    if (sortedBy === 'recordUrl') {
        // Apexへ送るName相当項目API名を返却
        return nameFieldApiName;
    }

    // 追加表示列は接頭辞を除去し、不正値にはName項目を使用
    return getApiNameFromDisplayFieldName(sortedBy, nameFieldApiName);
}

// Salesforce項目情報をdatatable列定義へ変換
function createDisplayFieldColumn(field) {
    // API名から行オブジェクト内の一意なキーを生成
    const fieldName = getDisplayFieldName(field.apiName);
    // データ型未指定時は文字列として表示
    const type = field.dataType ?? 'text';
    // 共通の表示、ソート、折り返し設定を構築
    const column = {
        // Salesforce項目ラベルを列見出しに使用
        label: field.label,
        // 平坦化した行オブジェクトのキーを参照
        fieldName,
        // Apexが返したdatatable対応型を使用
        type,
        // 追加表示項目によるサーバーソートを許可
        sortable: true,
        // 長い表示値をセル内で折り返す
        wrapText: true,
        // 追加列を読みやすい初期幅に設定
        initialWidth: 180
    };

    // URL型だけリンク用の表示属性を追加
    if (type === 'url') {
        // URL値自身をラベルに使い新しいタブで開く
        column.typeAttributes = {
            // 平坦化したURL値をリンクラベルにも使用
            label: { fieldName },
            // 外部URLを現在画面から分離して開く
            target: '_blank'
        };
    }

    // datatableへ渡す列定義を返却
    return column;
}

// 項目API名を行オブジェクト用の一意なキーへ変換
function getDisplayFieldName(apiName) {
    // Name列などのWrapper標準プロパティとの衝突を回避
    return `${DISPLAY_FIELD_PREFIX}${apiName}`;
}

// datatable列キーから元のSalesforce項目API名を復元
function getApiNameFromDisplayFieldName(fieldName, fallbackApiName) {
    // 追加表示列の接頭辞を持つ値だけを変換
    if (fieldName?.startsWith(DISPLAY_FIELD_PREFIX)) {
        // 接頭辞より後ろのAPI名部分を返却
        return fieldName.slice(DISPLAY_FIELD_PREFIX.length);
    }

    // 不正または未指定の列キーはName相当項目へフォールバック
    return fallbackApiName;
}