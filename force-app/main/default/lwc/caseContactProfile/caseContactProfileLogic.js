// 未設定または参照不可の値に使う代替表示
const UNAVAILABLE_VALUE = '-';

// UI APIから抽出したCase項目をプロフィール表示状態へ変換
export function createProfile({
    contactId,
    caseAccountId,
    contactAccountId,
    contactName,
    suppliedName,
    contactEmail,
    suppliedEmail,
    contactPhone,
    suppliedPhone,
    contactMobilePhone,
    contactFax,
    caseAccountName,
    contactAccountName,
    suppliedCompany,
    caseAccountWebsite,
    contactAccountWebsite,
    contactDepartment,
    contactTitle
} = {}) {
    // Case直接設定を優先し、なければContact所属先を会社として使用
    const accountId = caseAccountId || contactAccountId;
    // Contact設定有無に応じて顧客名の参照元を切り替え
    const resolvedContactName = contactId ? contactName : suppliedName;
    // Contact設定有無に応じてメールアドレスの参照元を切り替え
    const resolvedContactEmail = contactId ? contactEmail : suppliedEmail;
    // Contact設定有無に応じて電話番号の参照元を切り替え
    const resolvedContactPhone = contactId ? contactPhone : suppliedPhone;
    // Contact設定時だけ携帯電話番号を使用
    const resolvedMobilePhone = contactId ? contactMobilePhone : undefined;
    // Contact設定時だけFAX番号を使用
    const resolvedFax = contactId ? contactFax : undefined;
    // 会社の優先順位に応じて会社名を解決
    const companyName = caseAccountId
        ? caseAccountName
        : contactAccountId
          ? contactAccountName
          : suppliedCompany;
    // Account参照がある場合だけ優先順位に応じてWebサイトを解決
    const website = caseAccountId
        ? caseAccountWebsite
        : contactAccountId
          ? contactAccountWebsite
          : undefined;

    // テンプレートとwireが利用するプロフィール状態を返却
    return {
        // Contact関連リストとURL生成へ使うIDを保持
        contactId,
        // Caseへ直接設定されたAccount IDを保持
        caseAccountId,
        // Contactが所属するAccount IDを保持
        contactAccountId,
        // 会社関連リストとURL生成へ使う優先Account IDを保持
        accountId,
        // 顧客名を空欄なしの表示値へ変換
        contactName: resolvedContactName || UNAVAILABLE_VALUE,
        // メールリンクに使う実値を保持
        contactEmail: resolvedContactEmail,
        // メールアドレスを空欄なしの表示値へ変換
        contactEmailText: resolvedContactEmail || UNAVAILABLE_VALUE,
        // 電話リンクに使う実値を保持
        contactPhone: resolvedContactPhone,
        // 電話番号を空欄なしの表示値へ変換
        contactPhoneText: resolvedContactPhone || UNAVAILABLE_VALUE,
        // 携帯電話リンクに使う実値を保持
        contactMobilePhone: resolvedMobilePhone,
        // 携帯電話番号を空欄なしの表示値へ変換
        contactMobilePhoneText: resolvedMobilePhone || UNAVAILABLE_VALUE,
        // FAXリンクに使う実値を保持
        contactFax: resolvedFax,
        // FAX番号を空欄なしの表示値へ変換
        contactFaxText: resolvedFax || UNAVAILABLE_VALUE,
        // 会社名を空欄なしの表示値へ変換
        companyName: companyName || UNAVAILABLE_VALUE,
        // Webサイトリンクに使う実値を保持
        website,
        // Webサイトを空欄なしの表示値へ変換
        websiteText: website || UNAVAILABLE_VALUE,
        // Contactの部署を空欄なしの表示値へ変換
        department: (contactId && contactDepartment) || UNAVAILABLE_VALUE,
        // Contactの役職を空欄なしの表示値へ変換
        title: (contactId && contactTitle) || UNAVAILABLE_VALUE
    };
}

// 問い合わせ件数を空欄なしの表示値へ変換
export function formatCaseCount(caseCount) {
    // 未取得時だけ共通の代替値を表示
    return Number.isInteger(caseCount) ? caseCount : UNAVAILABLE_VALUE;
}
