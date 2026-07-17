import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { getFieldValue, getRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import CASE_ID_FIELD from '@salesforce/schema/Case.Id';
import CASE_ACCOUNT_ID_FIELD from '@salesforce/schema/Case.AccountId';
import CASE_CONTACT_ID_FIELD from '@salesforce/schema/Case.ContactId';
import CASE_NUMBER_FIELD from '@salesforce/schema/Case.CaseNumber';
import CASE_SUBJECT_FIELD from '@salesforce/schema/Case.Subject';
import CASE_STATUS_FIELD from '@salesforce/schema/Case.Status';
import CASE_LAST_MODIFIED_DATE_FIELD from '@salesforce/schema/Case.LastModifiedDate';

// Case本体の取得は必須項目を最小限にし、関連先の参照権限不足で全体を取得失敗させない
const CASE_FIELDS = [CASE_ID_FIELD];
// 顧客と会社は参照権限がない場合もコンポーネント全体を表示可能にする
const CASE_OPTIONAL_FIELDS = [CASE_CONTACT_ID_FIELD, CASE_ACCOUNT_ID_FIELD];
// 一覧の識別に必要なケース番号だけを必須とし、表示補助項目は権限に応じて取得
const RELATED_CASE_FIELDS = [CASE_NUMBER_FIELD];
// 件名、状況、更新日時は参照可能な項目だけをカードへ反映
const RELATED_CASE_OPTIONAL_FIELDS = [
    CASE_SUBJECT_FIELD,
    CASE_STATUS_FIELD,
    CASE_LAST_MODIFIED_DATE_FIELD
];
// ContactとAccountで共通するケース関連リストを指定
const CASES_RELATED_LIST_ID = 'Cases';
// 表示中のケースを除外しても最大5件を表示できるように1件多く取得
const RELATED_CASE_PAGE_SIZE = 6;
// 狭いサイドバーで一覧が長くなりすぎないよう表示数を制限
const DISPLAY_LIMIT = 5;
// 問い合わせの直近順を最終更新日時の降順で統一
const RELATED_CASE_SORT = ['-Case.LastModifiedDate'];
// 参照できない表示値を空欄にせず代替表示
const UNAVAILABLE_VALUE = '-';
// 件名が空のケースを識別できるよう代替表示
const MISSING_SUBJECT = '（件名なし）';

// Caseレコードページに関連問い合わせ一覧を提供
export default class CaseRelatedCaseList extends NavigationMixin(
    LightningElement
) {
    // レコードページから表示中CaseのIDを受け取る
    @api recordId;

    // 表示中CaseのUI APIレスポンスを保持
    caseRecord;
    // Case取得前だけ全体ローディングを表示
    caseHasLoaded = false;
    // Case取得失敗時の利用者向けメッセージを保持
    caseErrorMessage;
    // 顧客タブへ表示するケースカードを保持
    contactCases = [];
    // 会社タブへ表示するケースカードを保持
    accountCases = [];
    // 顧客側の初回取得完了状態を管理
    contactCasesHaveLoaded = false;
    // 会社側の初回取得完了状態を管理
    accountCasesHaveLoaded = false;
    // 顧客側の取得エラー表示を制御
    contactCasesHaveError = false;
    // 会社側の取得エラー表示を制御
    accountCasesHaveError = false;

    // 表示中Caseから顧客と会社を特定し、各タブの関連リスト取得を開始
    @wire(getRecord, {
        recordId: '$recordId',
        fields: CASE_FIELDS,
        optionalFields: CASE_OPTIONAL_FIELDS
    })
    wiredCase({ data, error }) {
        // 取得成功時は関連先の変更を判定して表示状態を更新
        if (data) {
            // 更新前のContactを保持して関連リストの切り替えを判定
            const previousContactId = this.contactId;
            // 更新前のAccountを保持して関連リストの切り替えを判定
            const previousAccountId = this.accountId;

            // 最新のCaseレスポンスを参照元として保存
            this.caseRecord = data;
            // Case取得完了後に全体ローディングを終了
            this.caseHasLoaded = true;
            // 再取得成功時は以前のエラー表示を解除
            this.caseErrorMessage = undefined;
            // 関連先が変わったタブだけ古い取得状態を破棄
            this.resetRelatedCasesWhenParentChanges(
                previousContactId,
                previousAccountId
            );
        // 取得失敗時は関連一覧を残さずコンポーネント全体をエラー表示
        } else if (error) {
            // 取得失敗したCaseレスポンスを参照しないよう破棄
            this.caseRecord = undefined;
            // エラー状態を描画するためCase取得を完了扱いに変更
            this.caseHasLoaded = true;
            // 詳細エラーを露出せず利用者向けメッセージへ統一
            this.caseErrorMessage =
                '関連する問い合わせを読み込めませんでした。時間をおいてもう一度お試しください。';
            // 親Caseを特定できないため両タブの関連一覧を初期化
            this.resetRelatedCases();
        }
    }

    // 顧客タブ用に同じContactへ紐づくケースを取得
    @wire(getRelatedListRecords, {
        parentRecordId: '$contactId',
        relatedListId: CASES_RELATED_LIST_ID,
        fields: RELATED_CASE_FIELDS,
        optionalFields: RELATED_CASE_OPTIONAL_FIELDS,
        pageSize: RELATED_CASE_PAGE_SIZE,
        sortBy: RELATED_CASE_SORT
    })
    async wiredContactCases({ data, error }) {
        // 取得成功時はUI APIレコードを表示用カードへ変換
        if (data) {
            // リンク生成を含むカード変換が完了してから一覧へ反映
            this.contactCases = await this.createCaseCards(data.records);
            // 顧客タブのローディングを終了
            this.contactCasesHaveLoaded = true;
            // 再取得成功時は顧客タブのエラー表示を解除
            this.contactCasesHaveError = false;
        // 顧客側だけ失敗した場合は会社タブへ影響させずエラー表示
        } else if (error) {
            // 以前取得した顧客ケースをエラー時に残さない
            this.contactCases = [];
            // 顧客タブをローディングからエラー状態へ遷移
            this.contactCasesHaveLoaded = true;
            // 顧客タブの取得失敗をテンプレートへ通知
            this.contactCasesHaveError = true;
        }
    }

    // 会社タブ用に同じAccountへ紐づくケースを取得
    @wire(getRelatedListRecords, {
        parentRecordId: '$accountId',
        relatedListId: CASES_RELATED_LIST_ID,
        fields: RELATED_CASE_FIELDS,
        optionalFields: RELATED_CASE_OPTIONAL_FIELDS,
        pageSize: RELATED_CASE_PAGE_SIZE,
        sortBy: RELATED_CASE_SORT
    })
    async wiredAccountCases({ data, error }) {
        // 取得成功時はUI APIレコードを表示用カードへ変換
        if (data) {
            // リンク生成を含むカード変換が完了してから一覧へ反映
            this.accountCases = await this.createCaseCards(data.records);
            // 会社タブのローディングを終了
            this.accountCasesHaveLoaded = true;
            // 再取得成功時は会社タブのエラー表示を解除
            this.accountCasesHaveError = false;
        // 会社側だけ失敗した場合は顧客タブへ影響させずエラー表示
        } else if (error) {
            // 以前取得した会社ケースをエラー時に残さない
            this.accountCases = [];
            // 会社タブをローディングからエラー状態へ遷移
            this.accountCasesHaveLoaded = true;
            // 会社タブの取得失敗をテンプレートへ通知
            this.accountCasesHaveError = true;
        }
    }

    // Caseの初回レスポンス前だけ全体ローディングを有効化
    get isLoadingCase() {
        // 取得完了状態をテンプレート用のローディング判定へ反転
        return !this.caseHasLoaded;
    }

    // 顧客タブの取得元となるContact IDを公開
    get contactId() {
        // 参照可能な場合だけCaseからContact IDを取得
        return this.getCaseValue(CASE_CONTACT_ID_FIELD);
    }

    // 会社タブの取得元となるAccount IDを公開
    get accountId() {
        // 参照可能な場合だけCaseからAccount IDを取得
        return this.getCaseValue(CASE_ACCOUNT_ID_FIELD);
    }

    // Contact設定済みかつ初回取得前の場合だけ顧客タブをローディング表示
    get isLoadingContactCases() {
        // Contact未設定時はローディングせず空状態を表示
        return Boolean(this.contactId) && !this.contactCasesHaveLoaded;
    }

    // Account設定済みかつ初回取得前の場合だけ会社タブをローディング表示
    get isLoadingAccountCases() {
        // Account未設定時はローディングせず空状態を表示
        return Boolean(this.accountId) && !this.accountCasesHaveLoaded;
    }

    // 顧客タブにカード一覧を描画できるか判定
    get hasContactCases() {
        // 1件以上ある場合だけ一覧領域を表示
        return this.contactCases.length > 0;
    }

    // 会社タブにカード一覧を描画できるか判定
    get hasAccountCases() {
        // 1件以上ある場合だけ一覧領域を表示
        return this.accountCases.length > 0;
    }

    // Contact設定有無に応じた顧客タブの空状態メッセージを返却
    get contactEmptyMessage() {
        // Contact設定済みの場合は関連ケース0件として案内
        return this.contactId
            ? 'この顧客の別の問い合わせはありません。'
            : 'このケースには顧客が設定されていません。';
    }

    // Account設定有無に応じた会社タブの空状態メッセージを返却
    get accountEmptyMessage() {
        // Account設定済みの場合は関連ケース0件として案内
        return this.accountId
            ? 'この会社の別の問い合わせはありません。'
            : 'このケースには会社が設定されていません。';
    }

    // Case取得前の項目参照を避けてUI APIの値を返却
    getCaseValue(field) {
        // Caseレスポンスが存在する場合だけ指定項目を参照
        return this.caseRecord ? getFieldValue(this.caseRecord, field) : undefined;
    }

    // UI APIレコードをテンプレートで扱うカード形式へ変換
    async createCaseCards(records = []) {
        // 表示中Case自身を除外し、狭いサイドバー向けの表示件数に制限
        const relatedCases = records
            .filter((record) => record.id !== this.recordId)
            .slice(0, DISPLAY_LIMIT);

        // 全ケースのURL生成完了後に同じ表示順でカード一覧を返却
        return Promise.all(
            // 各UI APIレコードを表示専用の値へ正規化
            relatedCases.map(async (record) => ({
                // 繰り返し描画のキーにCase IDを使用
                id: record.id,
                // ケース番号をカードのリンクラベルとして表示
                caseNumber:
                    getFieldValue(record, CASE_NUMBER_FIELD) ||
                    UNAVAILABLE_VALUE,
                // 件名未入力時もカードの内容を識別可能にする
                subject:
                    getFieldValue(record, CASE_SUBJECT_FIELD) ||
                    MISSING_SUBJECT,
                // 状況を参照できない場合は代替値を表示
                status:
                    getFieldValue(record, CASE_STATUS_FIELD) ||
                    UNAVAILABLE_VALUE,
                // 最終更新日時を日付表示コンポーネントへ渡す
                lastModifiedDate: getFieldValue(
                    record,
                    CASE_LAST_MODIFIED_DATE_FIELD
                ),
                // ケース番号から対象レコードへ遷移するURLを生成
                url: await this.generateCaseUrl(record.id)
            }))
        );
    }

    // Lightning Experienceに適したCaseレコードURLを生成
    generateCaseUrl(recordId) {
        // URL生成に失敗してもケース情報はリンクなしで表示を継続
        return this[NavigationMixin.GenerateUrl]({
            // Salesforceレコードページへの遷移種別を指定
            type: 'standard__recordPage',
            // 対象Caseと表示アクションを遷移属性へ設定
            attributes: {
                // 呼び出し元のCase IDを遷移先へ指定
                recordId,
                // ID解決をCaseオブジェクトとして明示
                objectApiName: 'Case',
                // 対象Caseの参照画面を開く
                actionName: 'view'
            }
        }).catch(() => undefined);
    }

    // ContactまたはAccount変更時に該当タブの状態だけを初期化
    resetRelatedCasesWhenParentChanges(
        previousContactId,
        previousAccountId
    ) {
        // レコードページ内の画面遷移で古い関連ケースを残さないよう取得状態を初期化
        if (previousContactId !== this.contactId) {
            // 以前のContactに紐づくカードを即時に破棄
            this.contactCases = [];
            // Contact未設定ならwire待ちをせず取得完了扱いに変更
            this.contactCasesHaveLoaded = !this.contactId;
            // 新しいContactの取得開始時に以前のエラーを解除
            this.contactCasesHaveError = false;
        }

        // Accountが変わった場合だけ会社タブの状態を更新
        if (previousAccountId !== this.accountId) {
            // 以前のAccountに紐づくカードを即時に破棄
            this.accountCases = [];
            // Account未設定ならwire待ちをせず取得完了扱いに変更
            this.accountCasesHaveLoaded = !this.accountId;
            // 新しいAccountの取得開始時に以前のエラーを解除
            this.accountCasesHaveError = false;
        }
    }

    // 親Case取得失敗時に両タブを表示可能な初期状態へ戻す
    resetRelatedCases() {
        // 顧客側のカードをすべて破棄
        this.contactCases = [];
        // 会社側のカードをすべて破棄
        this.accountCases = [];
        // 顧客側をwire待ちにせずエラーのない空状態へ移行
        this.contactCasesHaveLoaded = true;
        // 会社側をwire待ちにせずエラーのない空状態へ移行
        this.accountCasesHaveLoaded = true;
        // 親Caseエラーを優先するため顧客側の個別エラーを解除
        this.contactCasesHaveError = false;
        // 親Caseエラーを優先するため会社側の個別エラーを解除
        this.accountCasesHaveError = false;
    }
}
