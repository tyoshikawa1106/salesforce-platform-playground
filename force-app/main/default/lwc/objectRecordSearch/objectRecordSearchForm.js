import {
    FORM_MODE_FILE_UPLOAD,
    FORM_MODE_RECORD,
    getConfiguredFormFields,
    getObjectUiCapability
} from './objectRecordSearchFormPolicy';

export { FORM_MODE_FILE_UPLOAD, FORM_MODE_RECORD, getObjectUiCapability };

// フォームセクション名がない場合の既定ラベル
const DEFAULT_FORM_SECTION_LABEL = '基本情報';

// UI APIレスポンスから対象オブジェクトとモードのレイアウトを取得
export function getCurrentLayout({ formLayoutData, objectApiName, layoutMode }) {
    // レイアウト取得前はフォーム構築を開始しない
    if (!formLayoutData) {
        // 呼び出し側へ未取得状態を返却
        return undefined;
    }

    // getLayout応答構造を優先し、直接渡されたレイアウトにも対応
    return (
        formLayoutData.layouts?.[objectApiName]?.Full?.[layoutMode] ??
        formLayoutData
    );
}

// ページレイアウトを編集可能な標準項目のセクションへ変換
export function createLayoutFormSections({
    layout,
    fieldInfoByApiName = {},
    formRecordId
} = {}) {
    // 同じ項目が複数箇所へ配置されても一度だけ表示
    const fieldApiNames = new Set();
    // レイアウト順を保持するフォームセクション一覧を初期化
    const sections = [];

    // Salesforceページレイアウトのセクション順に変換
    (layout?.sections ?? []).forEach((section, index) => {
        // 現在セクションへ表示する項目一覧を初期化
        const fields = [];
        // セクション内の行を配置順に走査
        (section.layoutRows ?? []).forEach((row) => {
            // 行内のレイアウト項目を配置順に走査
            (row.layoutItems ?? []).forEach((item) => {
                // 複合項目を構成する各コンポーネントを確認
                (item.layoutComponents ?? []).forEach((component) => {
                    // レイアウトコンポーネントの項目API名を取得
                    const apiName = component.apiName;
                    // UI APIの項目権限と属性を参照
                    const fieldInfo = fieldInfoByApiName[apiName];
                    // 重複、非項目、編集不可、カスタム項目を除外
                    if (
                        component.componentType !== 'Field' ||
                        !apiName ||
                        fieldApiNames.has(apiName) ||
                        !isEditableLayoutItem(item, formRecordId) ||
                        !isSupportedStandardField(fieldInfo, formRecordId)
                    ) {
                        // 対象外コンポーネントは現在の反復だけを終了
                        return;
                    }

                    // 後続セクションで同じ項目を追加しないよう記録
                    fieldApiNames.add(apiName);
                    // lightning-input-fieldへ渡す最小情報を保持
                    fields.push({
                        // Salesforce項目API名をフォームへ設定
                        apiName,
                        // ページレイアウトの必須設定を真偽値へ正規化
                        required: Boolean(item.required)
                    });
                });
            });
        });

        // 編集可能項目を持つセクションだけを画面へ表示
        if (fields.length > 0) {
            // 見出しと項目をテンプレート用セクションへ変換
            sections.push(
                createFormSection(
                    section.heading || section.label || DEFAULT_FORM_SECTION_LABEL,
                    fields,
                    index
                )
            );
        }
    });

    // ページレイアウト順を維持したセクション一覧を返却
    return sections;
}

// オブジェクト別の必須項目をレイアウト由来セクションへ補完
export function applyFormFieldOverrides({
    sections = [],
    objectApiName,
    fieldInfoByApiName = {},
    formRecordId
} = {}) {
    // 対象オブジェクトへ設定された補完項目を取得
    const configuredFields = getConfiguredFormFields(objectApiName);
    // 補完不要またはレイアウトなしの場合は元の参照を返却
    if (configuredFields.length === 0 || sections.length === 0) {
        // 不要な配列複製を避けて入力セクションを返却
        return sections;
    }

    // 全セクションの既存項目API名を重複判定用に収集
    const existingFieldApiNames = new Set(
        sections.flatMap((section) =>
            section.fields.map((field) => field.apiName)
        )
    );
    // 呼び出し元の配列を変更しないようセクションと項目配列を複製
    const nextSections = sections.map((section) => ({
        ...section,
        // 各セクションの項目配列も独立して更新できるよう複製
        fields: [...section.fields]
    }));

    // 設定済み項目を不足追加または必須化
    configuredFields.forEach((field) => {
        // 補完候補のUI API項目情報を取得
        const fieldInfo = fieldInfoByApiName[field.apiName];
        // レイアウトにない利用可能項目は先頭セクションへ追加
        if (
            !existingFieldApiNames.has(field.apiName) &&
            isSupportedStandardField(fieldInfo, formRecordId)
        ) {
            // 基本入力として先頭セクションの末尾へ追加
            nextSections[0].fields.push(field);
            // 同じ補完処理内の重複追加を防止
            existingFieldApiNames.add(field.apiName);
            // 新規追加した項目の既存項目更新処理を省略
            return;
        }

        // 既存項目には設定側の必須条件だけを反映
        nextSections.forEach((section) => {
            // 対象項目以外の順序と参照を維持して変換
            section.fields = section.fields.map((sectionField) => {
                // API名が異なる項目は変更しない
                if (sectionField.apiName !== field.apiName) {
                    // 対象外項目の参照を維持して返却
                    return sectionField;
                }

                // レイアウトまたは設定のどちらかが必須なら必須化
                return {
                    ...sectionField,
                    // 既存必須設定を解除せず補完定義を統合
                    required: sectionField.required || field.required
                };
            });
        });
    });

    // 呼び出し元を変更せず補完済みセクションを返却
    return nextSections;
}

// レイアウト取得失敗時に表示する最小フォームを生成
export function createFallbackFormSections({
    objectApiName,
    nameFieldApiName
} = {}) {
    // オブジェクト別の安全な入力項目定義を取得
    const configuredFields = getConfiguredFormFields(objectApiName);
    // 定義済みオブジェクトはその項目を基本情報へ表示
    if (configuredFields.length > 0) {
        // 単一セクションとしてテンプレートへ返却
        return [
            createFormSection(DEFAULT_FORM_SECTION_LABEL, configuredFields, 0)
        ];
    }

    // Name相当項目も不明な場合は入力フォームを構築しない
    if (!nameFieldApiName) {
        // 表示可能な項目がない状態を空配列で返却
        return [];
    }

    // 未定義オブジェクトはName相当項目だけを必須表示
    return [
        createFormSection(
            DEFAULT_FORM_SECTION_LABEL,
            [
                // 作成対象を識別するName相当項目を設定
                {
                    // Apexで解決したName相当項目API名を使用
                    apiName: nameFieldApiName,
                    // 最小フォームでは識別名を必須入力にする
                    required: true
                }
            ],
            0
        )
    ];
}

// フォーム項目一覧をテンプレート用セクションへ変換
function createFormSection(label, fields, index) {
    // セクション順から繰り返し描画用の安定キーを生成
    const key = `section-${index}`;
    // 見出しと項目を画面表示用構造へまとめる
    return {
        // テンプレートのfor:eachで使用するキーを設定
        key,
        // aria-labelledbyで参照する見出しIDを生成
        headingId: `object-record-form-${key}`,
        // レイアウト見出しが空の場合は既定ラベルを使用
        label: label || DEFAULT_FORM_SECTION_LABEL,
        // 表示順を維持した入力項目一覧を設定
        fields
    };
}

// 作成または編集モードに応じてレイアウト項目の編集可否を判定
function isEditableLayoutItem(item, formRecordId) {
    // レコードIDがある場合は更新権限、ない場合は新規作成権限を使用
    return formRecordId ? item.editableForUpdate : item.editableForNew;
}

// 汎用フォームで扱える標準項目かつ操作可能か判定
function isSupportedStandardField(fieldInfo, formRecordId) {
    // 項目情報がない場合とカスタム項目は対象外
    if (!fieldInfo || fieldInfo.custom) {
        // 汎用フォームへ表示できない項目として返却
        return false;
    }

    // 編集時は更新権限、作成時は作成権限を使用
    return formRecordId ? fieldInfo.updateable : fieldInfo.createable;
}