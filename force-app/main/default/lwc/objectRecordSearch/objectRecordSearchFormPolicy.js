// Salesforce標準レコードフォームを使う画面モード
export const FORM_MODE_RECORD = 'record';
// ContentDocument向けファイルアップロード画面モード
export const FORM_MODE_FILE_UPLOAD = 'fileUpload';
// 汎用画面では作成と編集を提供しない画面モード
export const FORM_MODE_UNSUPPORTED = 'unsupported';

// ページレイアウト不足時にも必要項目を補えるオブジェクト別定義
const FORM_FIELD_OVERRIDES = {
    // 取引先の基本入力項目を定義
    Account: [
        // 取引先名を必須項目として補完
        { apiName: 'Name', required: true },
        // 業種を任意項目として補完
        { apiName: 'Industry', required: false }
    ],
    // 取引先責任者の氏名項目を定義
    Contact: [
        // 名を画面上の必須項目として補完
        { apiName: 'FirstName', required: true },
        // 姓を画面上の必須項目として補完
        { apiName: 'LastName', required: true }
    ],
    // リードの氏名と会社項目を定義
    Lead: [
        // 名を画面上の必須項目として補完
        { apiName: 'FirstName', required: true },
        // 姓を画面上の必須項目として補完
        { apiName: 'LastName', required: true },
        // 会社名を画面上の必須項目として補完
        { apiName: 'Company', required: true }
    ],
    // 商談作成に必要な主要項目を定義
    Opportunity: [
        // 商談名を画面上の必須項目として補完
        { apiName: 'Name', required: true },
        // フェーズを画面上の必須項目として補完
        { apiName: 'StageName', required: true },
        // 完了予定日を画面上の必須項目として補完
        { apiName: 'CloseDate', required: true }
    ]
};

// 個別定義がないオブジェクトは標準レコードフォームを使用
const DEFAULT_OBJECT_UI_CAPABILITY = {
    // 作成と編集をレコードフォームへ委譲
    formMode: FORM_MODE_RECORD,
    // 標準の新規作成ラベルを表示
    newButtonLabel: '新規'
};

// 汎用フォームと異なる操作が必要なオブジェクトを定義
const OBJECT_UI_CAPABILITIES = {
    // ファイルはContentDocumentフォームではなくアップロードで登録
    ContentDocument: {
        // ファイルアップロード画面へ切り替え
        formMode: FORM_MODE_FILE_UPLOAD,
        // 操作内容に合わせてボタン名を変更
        newButtonLabel: 'アップロード',
        // 利用者へ登録方法の違いを通知
        message: 'ファイルはアップロードで新規登録します。'
    },
    // メールメッセージは汎用フォーム操作の対象外
    EmailMessage: {
        // 作成と編集フォームを非表示にする
        formMode: FORM_MODE_UNSUPPORTED,
        // テンプレート参照時の既定ラベルを保持
        newButtonLabel: '新規',
        // 利用できない理由を画面へ通知
        message: 'メールメッセージは汎用フォームの対象外です。'
    }
};

// オブジェクト別に補完するフォーム項目を取得
export function getConfiguredFormFields(objectApiName) {
    // 個別定義がない場合は空配列を返却
    return FORM_FIELD_OVERRIDES[objectApiName] ?? [];
}

// 対象オブジェクトの画面操作方式を取得
export function getObjectUiCapability(objectApiName) {
    // 個別定義を優先し、それ以外は標準フォームへ委譲
    return OBJECT_UI_CAPABILITIES[objectApiName] ?? DEFAULT_OBJECT_UI_CAPABILITY;
}