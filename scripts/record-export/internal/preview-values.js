// 用途: 型に応じたサンプルを生成し、実値が必要な空欄は一項目ずつ検索する。

const { QUERY_TIMEOUT_CODES } = require('./error-definitions');

// 応答のない一回の検索を制限し、成功が続く補完全体は時間だけで打ち切らない。
const SUPPLEMENT_TIMEOUT_MS = 60000;

// 個別補完の前に、新しいレコードから値を探す件数を固定する。
const PREVIEW_RECORD_LIMIT = 200;

// 実レコードを検索しないプレビューの保存位置であり、SOQLや取得元IDには使用しない。
const GENERATED_RECORD_KEY = 'generated-preview';

// 住所全体と構成項目で同じデモ用値を使い、元データを問い合わせない。
const SAMPLE_ADDRESS = Object.freeze({
    street: 'サンプル町1-2-3',
    city: 'サンプル市',
    state: '東京都',
    stateCode: '13',
    country: 'JP',
    countryCode: 'JP',
    postalCode: '000-0000',
    latitude: 35.681236,
    longitude: 139.767125,
    geocodeAccuracy: 'Address'
});

// 項目名の推測ではなく、型と複合項目の所属から生成対象を決める。
function sampleForField(field, definitions) {
    // 指定項目が構成項目だけでも、Describe全体から親を確認する。
    const parent = definitions.get(field.compoundFieldName?.toLowerCase());
    // 住所・位置情報の構成項目を、通常の文字列・数値として検索しない。
    if (parent && ['address', 'location'].includes(parent.type)) {
        // カスタム複合項目は__cを外し、標準住所はAddressを外して構成名を求める。
        const prefix = parent.name.endsWith('__c')
            ? `${parent.name.slice(0, -3)}__`
            : parent.name.replace(/Address$/, '');
        // 標準位置情報は親名を持たないLatitude・Longitudeも構成項目として扱う。
        const component =
            parent.type === 'location' && ['Latitude', 'Longitude'].includes(field.name)
                ? field.name
                : field.name.startsWith(prefix)
                  ? field.name.slice(prefix.length).replace(/__s$/, '')
                  : '';
        // RESTが返すプロパティ名に揃えて固定値を参照する。
        const key = component.charAt(0).toLowerCase() + component.slice(1);
        // 位置情報の親では緯度・経度以外を生成しない。
        const value =
            parent.type === 'address' || ['latitude', 'longitude'].includes(key) ? SAMPLE_ADDRESS[key] : undefined;
        // 未知の構成項目は空欄と理由を残し、問い合わせによる漏れを防ぐ。
        return value === undefined ? { value: null, status: 'NO_SAMPLE_VALUE' } : { value, status: 'GENERATED' };
    }
    // 候補はレコードタイプで絞らず、有効な既定値を優先する。
    if (['picklist', 'multipicklist'].includes(field.type)) {
        // 無効な候補と空文字をデモ用の有効値として扱わない。
        const choices = (field.picklistValues || []).filter(
            (item) => item.active && typeof item.value === 'string' && item.value !== ''
        );
        // 複数選択でも一つの候補だけを採用する。
        const choice = choices.find((item) => item.defaultValue) || choices[0];
        // 有効な候補がなくても実データを補完検索しない。
        return choice ? { value: choice.value, status: 'GENERATED' } : { value: null, status: 'NO_PICKLIST_VALUE' };
    }
    // 一部分の伏字ではなく、元の値に依存しない固定値へ置き換える。
    if (field.type === 'email') return { value: 'demo@example.com', status: 'GENERATED' };
    // 電話とFAXは同じphone型として扱う。
    if (field.type === 'phone') return { value: '000-0000-0000', status: 'GENERATED' };
    // テキストエリア系は実値を検索せず、改行やHTMLを含まないデモ用の文面にする。
    if (field.type === 'textarea') {
        // DescribeのHTML形式と検索可否で、表示するサンプル文面の種類だけを区別する。
        const value = field.htmlFormatted
            ? '(リッチテキストのサンプル)'
            : field.filterable === false
              ? '(ロングテキストのサンプル)'
              : '(テキストエリアのサンプル)';
        // 既存の生成処理へ渡し、取得元IDは付けない。
        return { value, status: 'GENERATED' };
    }
    // 複合住所はCSVの一セルに格納できるオブジェクトとして生成する。
    if (field.type === 'address') return { value: { ...SAMPLE_ADDRESS }, status: 'GENERATED' };
    // 単独の位置情報も住所内の座標と同じ値を使う。
    if (field.type === 'location')
        return {
            value: { latitude: SAMPLE_ADDRESS.latitude, longitude: SAMPLE_ADDRESS.longitude },
            status: 'GENERATED'
        };
    // それ以外の型だけが実値の取得対象になる。
    return undefined;
}

// 補完だけの失敗は元レコードを保持して続行し、認証・API利用上限などは停止する。
const SKIPPABLE_CODES = new Set([
    ...QUERY_TIMEOUT_CODES,
    'CLI_TIMEOUT',
    'SUPPLEMENT_TIMEOUT',
    'NETWORK_TIMEOUT',
    'NETWORK_ERROR',
    'CLI_FAILED',
    'QUERY_FAILED',
    'INVALID_FIELD',
    'INSUFFICIENT_ACCESS',
    'MALFORMED_QUERY',
    'INVALID_QUERY_FILTER_OPERATOR',
    'QUERY_LENGTH_LIMIT',
    'QUERY_TOO_COMPLICATED',
    'BUFFER_LIMIT'
]);

// 一項目を検索し、値あり・値なし・スキップを確定する。検索順と再開位置は収集側で管理する。
async function resolvePreviewValue({ field, scope, searchSupplement, hasValue }) {
    // 検索の待機期限と結果表示で同じ開始時刻を使う。
    const started = performance.now();
    // 一項目の応答待ちだけを制限する。
    const deadline = started + SUPPLEMENT_TIMEOUT_MS;
    // 検索失敗を値なしと誤認せず、続行できる原因だけをスキップへ変換する。
    try {
        // 応答の完全性を検証した先頭レコード、またはゼロ件の結果を受け取る。
        const row = await searchSupplement(field, scope, { deadline });
        // 非NULL条件と矛盾する値を補完成功として保存しない。
        if (row && !hasValue(row[field.name])) throw new Error('非NULL検索の応答に補完可能な値がありません。');
        // 検索成功のゼロ件だけを値なしとし、実値には取得元IDを付ける。
        return row ? { value: row[field.name], source: row.Id } : null;
    } catch (error) {
        // 認証・保存・不正応答などは停止し、収集側で保存済み範囲を保持する。
        if (!SKIPPABLE_CODES.has(error.code)) throw error;
        // 同じ項目を再試行せず、失敗理由をCSVと再開記録へ渡す。
        return {
            skipped: error.code,
            diagnostic: error.diagnostic || `分類コード: ${error.code} / 詳細情報なし`,
            // 原因文がある場合だけ項目結果の直後へ表示する。
            ...(error.causeMessage ? { causeMessage: error.causeMessage } : {}),
            elapsedSeconds: ((performance.now() - started) / 1000).toFixed(1)
        };
    }
}

module.exports = {
    resolvePreviewValue,
    sampleForField,
    GENERATED_RECORD_KEY,
    SUPPLEMENT_TIMEOUT_MS,
    PREVIEW_RECORD_LIMIT
};
