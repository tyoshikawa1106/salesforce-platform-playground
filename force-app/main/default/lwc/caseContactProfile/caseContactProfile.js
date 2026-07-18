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
import {
    createEmptyCaseCountState,
    createProfile,
    formatCaseCount,
    hasCaseCount,
    shouldResetCaseCount
} from './caseContactProfileLogic';

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

    // UI API項目から生成したプロフィール表示状態を保持
    profile = createProfile();
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
            // 最新CaseのUI API項目をプロフィール表示状態へ変換
            this.profile = this.createProfileFromRecord(data);
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
            // 以前取得したプロフィール値を空状態へ戻す
            this.profile = createProfile();
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
        // Logicが解決したContact IDをwireとURL生成へ使用
        return this.profile.contactId;
    }

    // Caseへ直接設定されたAccount IDを取得
    get caseAccountId() {
        // Logicが保持するCase直接設定のAccount IDを返却
        return this.profile.caseAccountId;
    }

    // Contactが所属するAccount IDを取得
    get contactAccountId() {
        // Logicが保持するContact所属先のAccount IDを返却
        return this.profile.contactAccountId;
    }

    // 会社表示に使う優先Account IDを取得
    get accountId() {
        // Logicが優先順位に従って解決したAccount IDを返却
        return this.profile.accountId;
    }

    // ContactまたはWeb-to-Case入力の顧客名を表示
    get contactName() {
        // LogicがContactまたはWeb入力から解決した顧客名を返却
        return this.profile.contactName;
    }

    // ContactまたはWeb-to-Case入力のメールアドレスを取得
    get contactEmail() {
        // LogicがContactまたはWeb入力から解決したメールを返却
        return this.profile.contactEmail;
    }

    // メールアドレスを空欄なしの表示値へ変換
    get contactEmailText() {
        // Logicが空欄なしに整形したメール表示値を返却
        return this.profile.contactEmailText;
    }

    // ContactまたはWeb-to-Case入力の電話番号を取得
    get contactPhone() {
        // LogicがContactまたはWeb入力から解決した電話番号を返却
        return this.profile.contactPhone;
    }

    // 電話番号を空欄なしの表示値へ変換
    get contactPhoneText() {
        // Logicが空欄なしに整形した電話表示値を返却
        return this.profile.contactPhoneText;
    }

    // Contactに登録された携帯電話番号を取得
    get contactMobilePhone() {
        // LogicがContact設定時だけ採用した携帯電話番号を返却
        return this.profile.contactMobilePhone;
    }

    // 携帯電話番号を空欄なしの表示値へ変換
    get contactMobilePhoneText() {
        // Logicが空欄なしに整形した携帯電話表示値を返却
        return this.profile.contactMobilePhoneText;
    }

    // Contactに登録されたFAX番号を取得
    get contactFax() {
        // LogicがContact設定時だけ採用したFAX番号を返却
        return this.profile.contactFax;
    }

    // FAX番号を空欄なしの表示値へ変換
    get contactFaxText() {
        // Logicが空欄なしに整形したFAX表示値を返却
        return this.profile.contactFaxText;
    }

    // Case、Contact、Web入力の順で会社名を取得
    get companyName() {
        // Logicが会社優先順位に従って解決した表示名を返却
        return this.profile.companyName;
    }

    // CaseまたはContact経由の会社Webサイトを取得
    get website() {
        // Logicが会社優先順位に従って解決したWebサイトを返却
        return this.profile.website;
    }

    // 会社Webサイトを空欄なしの表示値へ変換
    get websiteText() {
        // Logicが空欄なしに整形したWebサイト表示値を返却
        return this.profile.websiteText;
    }

    // Contactに登録された部署を表示
    get department() {
        // LogicがContact設定有無を反映した部署表示値を返却
        return this.profile.department;
    }

    // Contactに登録された役職を表示
    get title() {
        // LogicがContact設定有無を反映した役職表示値を返却
        return this.profile.title;
    }

    // Contact問い合わせ件数を正常取得できたか判定
    get hasContactCaseCount() {
        // Contact件数の有効値判定をLogicへ委譲
        return hasCaseCount(this.contactCaseCount);
    }

    // Contact問い合わせ件数を表示用の値へ変換
    get contactCaseCountText() {
        // Contact件数の表示値生成をLogicへ委譲
        return formatCaseCount(this.contactCaseCount);
    }

    // Account問い合わせ件数を正常取得できたか判定
    get hasAccountCaseCount() {
        // Account件数の有効値判定をLogicへ委譲
        return hasCaseCount(this.accountCaseCount);
    }

    // Account問い合わせ件数を表示用の値へ変換
    get accountCaseCountText() {
        // Account件数の表示値生成をLogicへ委譲
        return formatCaseCount(this.accountCaseCount);
    }

    // UI APIレコードからLogicへ渡すプロフィール入力を抽出
    createProfileFromRecord(record) {
        // Schema参照を実値へ変換してLogicへまとめて渡す
        return createProfile({
            // Contact設定有無と関連リスト取得に使うIDを取得
            contactId: getFieldValue(record, CASE_CONTACT_ID_FIELD),
            // Caseへ直接設定されたAccount IDを取得
            caseAccountId: getFieldValue(record, CASE_ACCOUNT_ID_FIELD),
            // Contact所属先のAccount IDを取得
            contactAccountId: getFieldValue(
                record,
                CASE_CONTACT_ACCOUNT_ID_FIELD
            ),
            // Contactの氏名を取得
            contactName: getFieldValue(record, CASE_CONTACT_NAME_FIELD),
            // Web入力の氏名を取得
            suppliedName: getFieldValue(record, CASE_SUPPLIED_NAME_FIELD),
            // Contactのメールアドレスを取得
            contactEmail: getFieldValue(record, CASE_CONTACT_EMAIL_FIELD),
            // Web入力のメールアドレスを取得
            suppliedEmail: getFieldValue(record, CASE_SUPPLIED_EMAIL_FIELD),
            // Contactの電話番号を取得
            contactPhone: getFieldValue(record, CASE_CONTACT_PHONE_FIELD),
            // Web入力の電話番号を取得
            suppliedPhone: getFieldValue(record, CASE_SUPPLIED_PHONE_FIELD),
            // Contactの携帯電話番号を取得
            contactMobilePhone: getFieldValue(
                record,
                CASE_CONTACT_MOBILE_PHONE_FIELD
            ),
            // ContactのFAX番号を取得
            contactFax: getFieldValue(record, CASE_CONTACT_FAX_FIELD),
            // Case経由のAccount名を取得
            caseAccountName: getFieldValue(record, CASE_ACCOUNT_NAME_FIELD),
            // Contact経由のAccount名を取得
            contactAccountName: getFieldValue(
                record,
                CASE_CONTACT_ACCOUNT_NAME_FIELD
            ),
            // Web入力の会社名を取得
            suppliedCompany: getFieldValue(
                record,
                CASE_SUPPLIED_COMPANY_FIELD
            ),
            // Case経由のAccount Webサイトを取得
            caseAccountWebsite: getFieldValue(
                record,
                CASE_ACCOUNT_WEBSITE_FIELD
            ),
            // Contact経由のAccount Webサイトを取得
            contactAccountWebsite: getFieldValue(
                record,
                CASE_CONTACT_ACCOUNT_WEBSITE_FIELD
            ),
            // Contactの部署を取得
            contactDepartment: getFieldValue(
                record,
                CASE_CONTACT_DEPARTMENT_FIELD
            ),
            // Contactの役職を取得
            contactTitle: getFieldValue(record, CASE_CONTACT_TITLE_FIELD)
        });
    }

    // ContactまたはAccount変更時に対応する件数状態だけを初期化
    resetCaseCountsWhenParentChanges(
        previousContactId,
        previousAccountId
    ) {
        // Contactが変わった場合は以前の問い合わせ件数を破棄
        if (shouldResetCaseCount(previousContactId, this.contactId)) {
            // Contact件数を新しいwire応答待ちへ戻す
            this.resetContactCaseCount();
        }
        // Accountが変わった場合は以前の問い合わせ件数を破棄
        if (shouldResetCaseCount(previousAccountId, this.accountId)) {
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
        // Logicから共通の未取得状態を生成
        const state = createEmptyCaseCountState();
        // 未取得状態として件数を破棄
        this.contactCaseCount = state.count;
        // 上限超過表示を解除
        this.contactCaseCountHasMore = state.hasMore;
    }

    // Account問い合わせ件数の表示状態を初期化
    resetAccountCaseCount() {
        // Logicから共通の未取得状態を生成
        const state = createEmptyCaseCountState();
        // 未取得状態として件数を破棄
        this.accountCaseCount = state.count;
        // 上限超過表示を解除
        this.accountCaseCountHasMore = state.hasMore;
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
