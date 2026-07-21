import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { getFieldValue, getRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import CASE_ID_FIELD from '@salesforce/schema/Case.Id';
import CASE_ACCOUNT_ID_FIELD from '@salesforce/schema/Case.AccountId';
import CASE_CONTACT_ID_FIELD from '@salesforce/schema/Case.ContactId';
import CASE_NUMBER_FIELD from '@salesforce/schema/Case.CaseNumber';
import CASE_CREATED_DATE_FIELD from '@salesforce/schema/Case.CreatedDate';
import CASE_STATUS_FIELD from '@salesforce/schema/Case.Status';
import CASE_REASON_FIELD from '@salesforce/schema/Case.Reason';
import CASE_SUBJECT_FIELD from '@salesforce/schema/Case.Subject';
import CASE_ACCOUNT_NAME_FIELD from '@salesforce/schema/Case.Account.Name';
import CASE_CONTACT_NAME_FIELD from '@salesforce/schema/Case.Contact.Name';
import {
    createCaseCard,
    selectRelatedCaseRecords
} from './caseRelatedCaseListLogic';

// Case本体と現在Caseカードの識別に必要な項目を指定
const CASE_FIELDS = [CASE_ID_FIELD, CASE_NUMBER_FIELD, CASE_CREATED_DATE_FIELD];
// 顧客、会社、カード補助項目は参照権限がない場合も全体を表示可能にする
const CASE_OPTIONAL_FIELDS = [
    CASE_CONTACT_ID_FIELD,
    CASE_ACCOUNT_ID_FIELD,
    CASE_SUBJECT_FIELD,
    CASE_STATUS_FIELD,
    CASE_REASON_FIELD,
    CASE_ACCOUNT_NAME_FIELD,
    CASE_CONTACT_NAME_FIELD
];
// 一覧の識別と並び順に必要なケース番号、作成日時を取得
const RELATED_CASE_FIELDS = ['Case.CaseNumber', 'Case.CreatedDate'];
// 詳細表示項目は参照可能な場合だけカードへ反映
const RELATED_CASE_OPTIONAL_FIELDS = [
    'Case.Subject',
    'Case.Status',
    'Case.Reason',
    'Case.Account.Name',
    'Case.Contact.Name'
];
// ContactとAccountで共通するケース関連リストを指定
const CASES_RELATED_LIST_ID = 'Cases';
// 表示中Caseと組み合わせる作成日の新しいケースを最大表示件数まで取得
const RELATED_CASE_PAGE_SIZE = 20;
// 問い合わせの表示順を作成日時の降順で統一
const RELATED_CASE_SORT = ['-Case.CreatedDate'];

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
        // Contact設定済みの場合は参照可能な問い合わせ0件として案内
        return this.contactId
            ? 'この顧客の問い合わせはありません。'
            : 'このケースには取引先責任者が設定されていません。';
    }

    // Account設定有無に応じた会社タブの空状態メッセージを返却
    get accountEmptyMessage() {
        // Account設定済みの場合は参照可能な問い合わせ0件として案内
        return this.accountId
            ? 'この会社の問い合わせはありません。'
            : 'このケースには取引先が設定されていません。';
    }

    // Case取得前の項目参照を避けてUI APIの値を返却
    getCaseValue(field) {
        // Caseレスポンスが存在する場合だけ指定項目を参照
        return this.caseRecord ? getFieldValue(this.caseRecord, field) : undefined;
    }

    // UI APIレコードをテンプレートで扱うカード形式へ変換
    async createCaseCards(records = []) {
        // 表示中Caseを含め、作成日時の降順で表示件数を制限
        const relatedCases = selectRelatedCaseRecords(
            records,
            this.caseRecord
        );

        // 全ケースのURL生成完了後に同じ表示順でカード一覧を返却
        return Promise.all(
            // 各UI APIレコードを表示専用の値へ正規化
            relatedCases.map(async (record) => {
                // 現在Caseは同じ画面への不要なリンクを表示しない
                const isCurrentCase = record.id === this.recordId;

                // UI API値とNavigation結果の表示正規化をLogicへ委譲
                return createCaseCard({
                    // 繰り返し描画へ使うCase IDを渡す
                    id: record.id,
                    // UI APIから参照可能なケース番号を渡す
                    caseNumber: getFieldValue(record, CASE_NUMBER_FIELD),
                    // UI APIから参照可能な件名を渡す
                    subject: getFieldValue(record, CASE_SUBJECT_FIELD),
                    // UI APIから参照可能な状況を渡す
                    status: getFieldValue(record, CASE_STATUS_FIELD),
                    // UI APIから参照可能な原因を渡す
                    reason: getFieldValue(record, CASE_REASON_FIELD),
                    // UI APIから取得した作成日時を渡す
                    createdDate: getFieldValue(
                        record,
                        CASE_CREATED_DATE_FIELD
                    ),
                    // UI APIから参照可能な取引先名を渡す
                    accountName: getFieldValue(
                        record,
                        CASE_ACCOUNT_NAME_FIELD
                    ),
                    // UI APIから参照可能な取引先責任者名を渡す
                    contactName: getFieldValue(
                        record,
                        CASE_CONTACT_NAME_FIELD
                    ),
                    // 現在Case以外だけNavigationMixinでURLを生成
                    url: isCurrentCase
                        ? undefined
                        : await this.generateCaseUrl(record.id)
                });
            })
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
