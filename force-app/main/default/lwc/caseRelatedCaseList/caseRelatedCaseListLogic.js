// 狭いサイドバーで一覧が長くなりすぎないよう表示数を制限
const DISPLAY_LIMIT = 5;
// 参照できない表示値を空欄にせず代替表示
const UNAVAILABLE_VALUE = '-';
// 件名が空のケースを識別できるよう代替表示
const MISSING_SUBJECT = '（件名なし）';

// 表示中Caseを除外してカード変換対象を選別
export function selectRelatedCaseRecords(records = [], currentRecordId) {
    // 表示中Case自身を除外し、狭いサイドバー向けの表示件数に制限
    return records
        .filter((record) => record.id !== currentRecordId)
        .slice(0, DISPLAY_LIMIT);
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
        // URL生成に失敗した場合はリンクなしとして保持
        url
    };
}

// 親レコード設定有無に応じた関連一覧の取得状態を生成
export function createRelatedListResetState(parentRecordId) {
    // 新しい親のwire応答を待つための初期状態を返却
    return {
        // 以前の親に紐づくカードを破棄
        cases: [],
        // 親未設定ならwire待ちをせず取得完了扱いに変更
        hasLoaded: !parentRecordId,
        // 新しい親の取得開始時に以前のエラーを解除
        hasError: false
    };
}

// 親Case取得失敗時に両タブへ反映する状態を生成
export function createAllRelatedListsResetState() {
    // 両タブをエラーのない空状態へ戻す
    return {
        // 顧客側のカードをすべて破棄
        contactCases: [],
        // 会社側のカードをすべて破棄
        accountCases: [],
        // 顧客側をwire待ちにせず取得完了扱いに変更
        contactCasesHaveLoaded: true,
        // 会社側をwire待ちにせず取得完了扱いに変更
        accountCasesHaveLoaded: true,
        // 親Caseエラーを優先するため顧客側の個別エラーを解除
        contactCasesHaveError: false,
        // 親Caseエラーを優先するため会社側の個別エラーを解除
        accountCasesHaveError: false
    };
}

// 親レコードの変更に応じて関連一覧を初期化するか判定
export function shouldResetRelatedList(previousParentId, currentParentId) {
    // 同じ親を再取得した場合は現在の一覧状態を維持
    return previousParentId !== currentParentId;
}

// 親レコードと取得状態からタブのローディングを判定
export function isRelatedListLoading(parentRecordId, hasLoaded) {
    // 親未設定時はローディングせず空状態を表示
    return Boolean(parentRecordId) && !hasLoaded;
}

// 親レコード設定有無に応じた空状態メッセージを生成
export function createEmptyMessage({
    parentRecordId,
    emptyMessage,
    missingParentMessage
}) {
    // 親設定済みなら0件、未設定なら親なしとして案内
    return parentRecordId ? emptyMessage : missingParentMessage;
}
