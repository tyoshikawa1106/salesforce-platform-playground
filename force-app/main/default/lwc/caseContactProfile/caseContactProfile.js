import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { getFieldValue, getRecord } from 'lightning/uiRecordApi';
import { getRelatedListCount } from 'lightning/uiRelatedListApi';
import CASE_ACCOUNT_ID_FIELD from '@salesforce/schema/Case.AccountId';
import CASE_ACCOUNT_NAME_FIELD from '@salesforce/schema/Case.Account.Name';
import CASE_ACCOUNT_WEBSITE_FIELD from '@salesforce/schema/Case.Account.Website';
import CASE_CONTACT_ID_FIELD from '@salesforce/schema/Case.ContactId';
import CASE_CONTACT_ACCOUNT_ID_FIELD from '@salesforce/schema/Case.Contact.AccountId';
import CASE_CONTACT_NAME_FIELD from '@salesforce/schema/Case.Contact.Name';
import CASE_CONTACT_EMAIL_FIELD from '@salesforce/schema/Case.Contact.Email';
import CASE_CONTACT_PHONE_FIELD from '@salesforce/schema/Case.Contact.Phone';
import CASE_CONTACT_MOBILE_PHONE_FIELD from '@salesforce/schema/Case.Contact.MobilePhone';
import CASE_CONTACT_FAX_FIELD from '@salesforce/schema/Case.Contact.Fax';
import CASE_CONTACT_DEPARTMENT_FIELD from '@salesforce/schema/Case.Contact.Department';
import CASE_CONTACT_TITLE_FIELD from '@salesforce/schema/Case.Contact.Title';
import CASE_CONTACT_ACCOUNT_NAME_FIELD from '@salesforce/schema/Case.Contact.Account.Name';
import CASE_CONTACT_ACCOUNT_WEBSITE_FIELD from '@salesforce/schema/Case.Contact.Account.Website';
import CASE_SUPPLIED_NAME_FIELD from '@salesforce/schema/Case.SuppliedName';
import CASE_SUPPLIED_EMAIL_FIELD from '@salesforce/schema/Case.SuppliedEmail';
import CASE_SUPPLIED_PHONE_FIELD from '@salesforce/schema/Case.SuppliedPhone';
import CASE_SUPPLIED_COMPANY_FIELD from '@salesforce/schema/Case.SuppliedCompany';

// Case取得に必須なContact参照だけを指定
const REQUIRED_FIELDS = [CASE_CONTACT_ID_FIELD];
// 権限に応じて取得するプロフィール表示項目を指定
const OPTIONAL_FIELDS = [
    CASE_ACCOUNT_ID_FIELD,
    CASE_ACCOUNT_NAME_FIELD,
    CASE_ACCOUNT_WEBSITE_FIELD,
    CASE_CONTACT_ACCOUNT_ID_FIELD,
    CASE_CONTACT_NAME_FIELD,
    CASE_CONTACT_EMAIL_FIELD,
    CASE_CONTACT_PHONE_FIELD,
    CASE_CONTACT_MOBILE_PHONE_FIELD,
    CASE_CONTACT_FAX_FIELD,
    CASE_CONTACT_DEPARTMENT_FIELD,
    CASE_CONTACT_TITLE_FIELD,
    CASE_CONTACT_ACCOUNT_NAME_FIELD,
    CASE_CONTACT_ACCOUNT_WEBSITE_FIELD,
    CASE_SUPPLIED_NAME_FIELD,
    CASE_SUPPLIED_EMAIL_FIELD,
    CASE_SUPPLIED_PHONE_FIELD,
    CASE_SUPPLIED_COMPANY_FIELD
];
// 未設定または参照不可の値に使う代替表示
const UNAVAILABLE_VALUE = '-';
// ContactレコードURL生成時のオブジェクトAPI名
const CONTACT_OBJECT_API_NAME = 'Contact';
// AccountレコードURL生成時のオブジェクトAPI名
const ACCOUNT_OBJECT_API_NAME = 'Account';
// ContactとAccountの問い合わせ件数に使う関連リストID
const CASES_RELATED_LIST_ID = 'Cases';
// UI APIが正確な件数として返す取得上限
const RELATED_LIST_MAX_COUNT = 1999;

// Caseレコードページに顧客と会社のプロフィールを表示
export default class CaseContactProfile extends NavigationMixin(
    LightningElement
) {
    // レコードページから表示中CaseのIDを受け取る
    @api recordId;

    // UI APIから取得したCaseレコードを保持
    caseRecord;
    // Case取得失敗時の利用者向けメッセージを保持
    errorMessage;
    // Caseの初回レスポンス受信状態を保持
    hasLoaded = false;
    // Contact詳細ページへの遷移URLを保持
    contactRecordUrl;
    // Account詳細ページへの遷移URLを保持
    accountRecordUrl;
    // Contactに関連する問い合わせ件数を保持
    contactCaseCount;
    // Contactの問い合わせ件数が取得上限を超えた状態を保持
    contactCaseCountHasMore = false;
    // Accountに関連する問い合わせ件数を保持
    accountCaseCount;
    // Accountの問い合わせ件数が取得上限を超えた状態を保持
    accountCaseCountHasMore = false;

    // 表示中Caseと参照可能なプロフィール項目を取得
    @wire(getRecord, {
        recordId: '$recordId',
        fields: REQUIRED_FIELDS,
        optionalFields: OPTIONAL_FIELDS
    })
    wiredCase({ data, error }) {
        // 取得成功時は関連先の変更を判定して表示を更新
        if (data) {
            // 更新前のContact IDを件数リセット判定用に保持
            const previousContactId = this.contactId;
            // 更新前のAccount IDを件数リセット判定用に保持
            const previousAccountId = this.accountId;

            // 初回ローディングを終了
            this.hasLoaded = true;
            // 最新Caseをプロフィール値の参照元として保存
            this.caseRecord = data;
            // 再取得成功時は以前のエラー表示を解除
            this.errorMessage = undefined;
            // 親レコードが変わった件数だけを未取得状態へ戻す
            this.resetCaseCountsWhenParentChanges(
                previousContactId,
                previousAccountId
            );
            // 最新のContactとAccountに対応するURLを非同期生成
            this.updateRecordUrls();
        // 取得失敗時はプロフィール全体をエラー状態へ移行
        } else if (error) {
            // エラー表示へ切り替えるため初回取得を完了扱いにする
            this.hasLoaded = true;
            // 以前取得したCaseの値を表示しないよう破棄
            this.caseRecord = undefined;
            // 古いContactへのリンクを破棄
            this.contactRecordUrl = undefined;
            // 古いAccountへのリンクを破棄
            this.accountRecordUrl = undefined;
            // 親を特定できないため両方の件数状態を初期化
            this.resetCaseCounts();
            // 詳細を露出しない利用者向け文言へ統一
            this.errorMessage =
                '取引先責任者のプロフィールを読み込めませんでした。時間をおいてもう一度お試しください。';
        }
    }

    // Contactに紐づく問い合わせ件数をUI APIから取得
    @wire(getRelatedListCount, {
        parentRecordId: '$contactId',
        relatedListId: CASES_RELATED_LIST_ID,
        maxCount: RELATED_LIST_MAX_COUNT
    })
    wiredContactCaseCount({ data, error }) {
        // 取得成功時は件数と上限超過状態を反映
        if (data) {
            // Contactタブに表示する正確な件数を保存
            this.contactCaseCount = data.count;
            // 上限より多い場合のプラス表示を制御
            this.contactCaseCountHasMore = data.hasMore === true;
        // 取得失敗時はプロフィールを残し件数だけ未取得へ戻す
        } else if (error) {
            // Contact件数の表示状態を共通処理で初期化
            this.resetContactCaseCount();
        }
    }

    // Accountに紐づく問い合わせ件数をUI APIから取得
    @wire(getRelatedListCount, {
        parentRecordId: '$accountId',
        relatedListId: CASES_RELATED_LIST_ID,
        maxCount: RELATED_LIST_MAX_COUNT
    })
    wiredAccountCaseCount({ data, error }) {
        // 取得成功時は件数と上限超過状態を反映
        if (data) {
            // Accountタブに表示する正確な件数を保存
            this.accountCaseCount = data.count;
            // 上限より多い場合のプラス表示を制御
            this.accountCaseCountHasMore = data.hasMore === true;
        // 取得失敗時はプロフィールを残し件数だけ未取得へ戻す
        } else if (error) {
            // Account件数の表示状態を共通処理で初期化
            this.resetAccountCaseCount();
        }
    }

    // Caseの初回レスポンス前だけローディングを表示
    get isLoading() {
        // 取得完了状態をテンプレート用の判定へ反転
        return !this.hasLoaded;
    }

    // 表示中Caseに設定されたContact IDを取得
    get contactId() {
        // Case未取得時と参照不可時はundefinedを返却
        return this.getValue(CASE_CONTACT_ID_FIELD);
    }

    // Caseへ直接設定されたAccount IDを取得
    get caseAccountId() {
        // Case未取得時と参照不可時はundefinedを返却
        return this.getValue(CASE_ACCOUNT_ID_FIELD);
    }

    // Contactが所属するAccount IDを取得
    get contactAccountId() {
        // Contact未設定または参照不可時はundefinedを返却
        return this.getValue(CASE_CONTACT_ACCOUNT_ID_FIELD);
    }

    // 会社表示に使う優先Account IDを取得
    get accountId() {
        // Case直接設定を優先し、なければContact所属先を使用
        return this.caseAccountId || this.contactAccountId;
    }

    // ContactまたはWeb-to-Case入力の顧客名を表示
    get contactName() {
        // 取得できない値を代替表示へ変換
        return this.getDisplayValue(
            // Contact設定有無に応じて参照元を切り替え
            this.getContactValue(
                CASE_CONTACT_NAME_FIELD,
                CASE_SUPPLIED_NAME_FIELD
            )
        );
    }

    // ContactまたはWeb-to-Case入力のメールアドレスを取得
    get contactEmail() {
        // Contact設定有無に応じて参照元を切り替え
        return this.getContactValue(
            CASE_CONTACT_EMAIL_FIELD,
            CASE_SUPPLIED_EMAIL_FIELD
        );
    }

    // メールアドレスを空欄なしの表示値へ変換
    get contactEmailText() {
        // 未設定時は共通の代替値を返却
        return this.contactEmail || UNAVAILABLE_VALUE;
    }

    // ContactまたはWeb-to-Case入力の電話番号を取得
    get contactPhone() {
        // Contact設定有無に応じて参照元を切り替え
        return this.getContactValue(
            CASE_CONTACT_PHONE_FIELD,
            CASE_SUPPLIED_PHONE_FIELD
        );
    }

    // 電話番号を空欄なしの表示値へ変換
    get contactPhoneText() {
        // 未設定時は共通の代替値を返却
        return this.contactPhone || UNAVAILABLE_VALUE;
    }

    // Contactに登録された携帯電話番号を取得
    get contactMobilePhone() {
        // Contact未設定時はWeb入力へフォールバックしない
        return this.getContactValue(CASE_CONTACT_MOBILE_PHONE_FIELD);
    }

    // 携帯電話番号を空欄なしの表示値へ変換
    get contactMobilePhoneText() {
        // 未設定時は共通の代替値を返却
        return this.contactMobilePhone || UNAVAILABLE_VALUE;
    }

    // Contactに登録されたFAX番号を取得
    get contactFax() {
        // Contact未設定時はWeb入力へフォールバックしない
        return this.getContactValue(CASE_CONTACT_FAX_FIELD);
    }

    // FAX番号を空欄なしの表示値へ変換
    get contactFaxText() {
        // 未設定時は共通の代替値を返却
        return this.contactFax || UNAVAILABLE_VALUE;
    }

    // Case、Contact、Web入力の順で会社名を取得
    get companyName() {
        // Caseへ直接設定されたAccount名を最優先
        if (this.caseAccountId) {
            // Account参照名を空欄なしの表示値へ変換
            return this.getDisplayValue(CASE_ACCOUNT_NAME_FIELD);
        }
        // Case直接設定がない場合はContact所属先を使用
        if (this.contactAccountId) {
            // Contact経由のAccount名を表示値へ変換
            return this.getDisplayValue(
                CASE_CONTACT_ACCOUNT_NAME_FIELD
            );
        }
        // Account参照がない場合はWeb-to-Case入力会社名を使用
        return this.getDisplayValue(CASE_SUPPLIED_COMPANY_FIELD);
    }

    // CaseまたはContact経由の会社Webサイトを取得
    get website() {
        // Caseへ直接設定されたAccountのWebサイトを優先
        if (this.caseAccountId) {
            // Case経由のAccount Webサイトを返却
            return this.getValue(CASE_ACCOUNT_WEBSITE_FIELD);
        }
        // Case直接設定がない場合はContact所属先を使用
        if (this.contactAccountId) {
            // Contact経由のAccount Webサイトを返却
            return this.getValue(CASE_CONTACT_ACCOUNT_WEBSITE_FIELD);
        }
        // Account参照がない場合はリンクを表示しない
        return undefined;
    }

    // 会社Webサイトを空欄なしの表示値へ変換
    get websiteText() {
        // 未設定時は共通の代替値を返却
        return this.website || UNAVAILABLE_VALUE;
    }

    // Contactに登録された部署を表示
    get department() {
        // Contact未設定時も代替表示を返却
        return this.getDisplayValue(
            this.getContactValue(CASE_CONTACT_DEPARTMENT_FIELD)
        );
    }

    // Contactに登録された役職を表示
    get title() {
        // Contact未設定時も代替表示を返却
        return this.getDisplayValue(
            this.getContactValue(CASE_CONTACT_TITLE_FIELD)
        );
    }

    // Contact問い合わせ件数を正常取得できたか判定
    get hasContactCaseCount() {
        // 0件を有効値として扱える整数判定を使用
        return Number.isInteger(this.contactCaseCount);
    }

    // Contact問い合わせ件数を表示用の値へ変換
    get contactCaseCountText() {
        // 未取得時だけ代替値を表示
        return this.hasContactCaseCount
            ? this.contactCaseCount
            : UNAVAILABLE_VALUE;
    }

    // Account問い合わせ件数を正常取得できたか判定
    get hasAccountCaseCount() {
        // 0件を有効値として扱える整数判定を使用
        return Number.isInteger(this.accountCaseCount);
    }

    // Account問い合わせ件数を表示用の値へ変換
    get accountCaseCountText() {
        // 未取得時だけ代替値を表示
        return this.hasAccountCaseCount
            ? this.accountCaseCount
            : UNAVAILABLE_VALUE;
    }

    // 保存済みCaseから指定項目の値を安全に取得
    getValue(field) {
        // UI APIヘルパーへ未取得レコードもそのまま渡す
        return getFieldValue(this.caseRecord, field);
    }

    // 項目参照または実値を空欄なしの表示値へ変換
    getDisplayValue(valueOrField) {
        // Schema項目参照の場合だけCaseから値を取得
        const value =
            valueOrField && typeof valueOrField === 'object'
                ? this.getValue(valueOrField)
                : valueOrField;
        // 空の値には共通の代替表示を使用
        return value || UNAVAILABLE_VALUE;
    }

    // Contact設定有無に応じてContact項目とWeb入力項目を切り替え
    getContactValue(contactField, suppliedField) {
        // Contact設定済みならContact項目だけを参照
        if (this.contactId) {
            // Contactレコード上の指定項目値を返却
            return this.getValue(contactField);
        }
        // Contact未設定時は指定されたWeb入力項目へフォールバック
        return suppliedField ? this.getValue(suppliedField) : undefined;
    }

    // ContactまたはAccount変更時に対応する件数状態だけを初期化
    resetCaseCountsWhenParentChanges(
        previousContactId,
        previousAccountId
    ) {
        // Contactが変わった場合は以前の問い合わせ件数を破棄
        if (previousContactId !== this.contactId) {
            // Contact件数を新しいwire応答待ちへ戻す
            this.resetContactCaseCount();
        }
        // Accountが変わった場合は以前の問い合わせ件数を破棄
        if (previousAccountId !== this.accountId) {
            // Account件数を新しいwire応答待ちへ戻す
            this.resetAccountCaseCount();
        }
    }

    // ContactとAccountの問い合わせ件数状態をまとめて初期化
    resetCaseCounts() {
        // Contact側の件数と上限状態を初期化
        this.resetContactCaseCount();
        // Account側の件数と上限状態を初期化
        this.resetAccountCaseCount();
    }

    // Contact問い合わせ件数の表示状態を初期化
    resetContactCaseCount() {
        // 未取得状態として件数を破棄
        this.contactCaseCount = undefined;
        // 上限超過表示を解除
        this.contactCaseCountHasMore = false;
    }

    // Account問い合わせ件数の表示状態を初期化
    resetAccountCaseCount() {
        // 未取得状態として件数を破棄
        this.accountCaseCount = undefined;
        // 上限超過表示を解除
        this.accountCaseCountHasMore = false;
    }

    // 最新のContactとAccountに対応するレコードURLを更新
    async updateRecordUrls() {
        // 非同期処理開始時点のContact IDを保持
        const contactId = this.contactId;
        // 非同期処理開始時点のAccount IDを保持
        const accountId = this.accountId;
        // 両方のURLを並行して生成
        const [contactRecordUrl, accountRecordUrl] = await Promise.all([
            this.generateRecordUrl(contactId, CONTACT_OBJECT_API_NAME),
            this.generateRecordUrl(accountId, ACCOUNT_OBJECT_API_NAME)
        ]);

        // URL生成中に親レコードが変わっていない場合だけ反映
        if (contactId === this.contactId && accountId === this.accountId) {
            // 最新Contactの詳細ページURLを保存
            this.contactRecordUrl = contactRecordUrl;
            // 最新Accountの詳細ページURLを保存
            this.accountRecordUrl = accountRecordUrl;
        }
    }

    // Lightning Experienceに適した標準レコードURLを生成
    generateRecordUrl(recordId, objectApiName) {
        // 対象IDがない場合はリンクなしとして即時解決
        if (!recordId) {
            // 呼び出し側の並行処理へundefinedをPromiseで返却
            return Promise.resolve(undefined);
        }
        // NavigationMixinへ標準レコードページ遷移を要求
        return this[NavigationMixin.GenerateUrl]({
            // Salesforceレコードページへの遷移種別を指定
            type: 'standard__recordPage',
            // 対象レコードと表示アクションを設定
            attributes: {
                // 呼び出し元が解決したレコードIDを指定
                recordId,
                // ID解決に使うオブジェクトAPI名を指定
                objectApiName,
                // 対象レコードの参照画面を開く
                actionName: 'view'
            }
        // URL生成失敗時もプロフィール表示を継続
        }).catch(() => undefined);
    }
}
