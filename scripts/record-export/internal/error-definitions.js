// 用途: CLI待機上限と、CLI・REST検索で共有するエラー識別子を一箇所で管理する。

// 実行時の制限と利用者向け表示で同じ待機時間を使う。
const CLI_TIMEOUT_MS = 120000;

// Salesforce側の検索時間制限を通信・ローカル待機制限と区別する。
const QUERY_TIMEOUT_CODES = Object.freeze(['QUERY_TIMEOUT', 'REQUEST_RUNNING_TOO_LONG']);

// CLIとComposite応答の両方で認識する検索エラーだけを共有する。
const QUERY_ERROR_CODES = Object.freeze([
    'INVALID_FIELD',
    'INSUFFICIENT_ACCESS',
    'MALFORMED_QUERY',
    'INVALID_QUERY_FILTER_OPERATOR',
    'REQUEST_LIMIT_EXCEEDED',
    ...QUERY_TIMEOUT_CODES
]);

// 端末とCSVで同じ日本語を使い、内部の原因コードと表示文を分離する。
const ERROR_REASONS = Object.freeze({
    QUERY_TIMEOUT: '検索タイムアウト',
    REQUEST_RUNNING_TOO_LONG: '検索タイムアウト',
    CLI_TIMEOUT: 'CLI待機時間超過',
    SUPPLEMENT_TIMEOUT: '補完待機時間超過',
    NETWORK_TIMEOUT: '通信タイムアウト',
    NETWORK_ERROR: '通信エラー',
    CLI_FAILED: 'CLI実行失敗',
    QUERY_FAILED: '検索失敗',
    INVALID_FIELD: 'API名が存在しない、または項目参照権限がありません',
    INSUFFICIENT_ACCESS: '参照権限がありません',
    MALFORMED_QUERY: 'クエリが無効',
    INVALID_QUERY_FILTER_OPERATOR: '検索条件が無効',
    QUERY_LENGTH_LIMIT: 'クエリ長の上限超過',
    QUERY_TOO_COMPLICATED: 'クエリの複雑さの上限超過',
    BUFFER_LIMIT: '受信サイズの上限超過',
    AUTH_FAILED: '認証エラー',
    REQUEST_LIMIT_EXCEEDED: 'API利用上限超過',
    INVALID_QUERY_RESPONSE: '検索応答の不整合',
    CLI_NOT_FOUND: 'CLIが見つかりません',
    CLI_ACCESS_DENIED: 'CLIの実行権限がありません'
});

// 原因コードは内部判定に保持し、利用者には対応する日本語を返す。
function errorReason(code) {
    // 未知のコードでも英語だけの表示に戻さない。
    return Object.hasOwn(ERROR_REASONS, code) ? ERROR_REASONS[code] : '検索失敗';
}

module.exports = { CLI_TIMEOUT_MS, QUERY_TIMEOUT_CODES, QUERY_ERROR_CODES, errorReason };
