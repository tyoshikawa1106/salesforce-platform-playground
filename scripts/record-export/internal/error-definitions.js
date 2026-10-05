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

module.exports = { CLI_TIMEOUT_MS, QUERY_TIMEOUT_CODES, QUERY_ERROR_CODES };
