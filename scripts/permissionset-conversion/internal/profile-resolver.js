// 実行方法: ProfileからPermission Setを生成する入口スクリプトから読み込む。
// 用途: ローカルProfile sourceファイル名をmetadata fullNameとPermission Set名へ変換する。

const { validatePermissionSetApiName } = require('./profile-converter');

const profileFileSuffix = '.profile-meta.xml';
const maxUserLicenseApiNameLength = 32;
const guestUserLicenseKeys = new Set(['guestuserlicense', 'guestuserlicence']);
const chatterUserLicenseKeys = new Set(['chatterexternal', 'chatterfree']);

// Salesforce source形式のpercent encodingを1回だけ戻し、論理fullNameとして正規化する。
function decodeProfileFullName(encodedName, sourceDescription) {
    try {
        return decodeURIComponent(encodedName).normalize('NFC');
    } catch (error) {
        throw new Error(`${sourceDescription}をデコードできません: ${encodedName}: ${error.message}`);
    }
}

// Profile sourceファイル名を検証し、接尾辞を除いた論理fullNameへ変換する。
function decodeProfileFileName(fileName) {
    if (typeof fileName !== 'string' || !fileName.endsWith(profileFileSuffix)) {
        throw new Error(`Profile metadataのファイル名が不正です: ${fileName}`);
    }

    const encodedName = fileName.slice(0, -profileFileSuffix.length);

    return decodeProfileFullName(encodedName, 'Profile metadataのファイル名');
}

// User LicenseをPermission Set API名で使用できる英数字だけへ正規化する。
function normalizeUserLicenseForApiName(userLicense) {
    // 元ProfileにUser Licenseがない状態では命名規則を成立させない。
    if (typeof userLicense !== 'string' || userLicense.trim() === '') {
        throw new Error('仮API名へ使用する元ProfileのUser Licenseを指定してください。');
    }

    // API名の区切りと混同しないよう、User License内の空白と記号を除去する。
    const normalizedLicense = userLicense
        .trim()
        .normalize('NFKC')
        .replace(/[^A-Za-z0-9]+/gu, '');

    // 変換後に識別文字が残らないUser Licenseは推測で命名しない。
    if (normalizedLicense === '') {
        throw new Error(`元ProfileのUser LicenseをPermission Set API名へ変換できません: ${userLicense}`);
    }

    // 日時、出力重複連番、Profile連番を含めてもAPI名が80文字以内になる長さへ制限する。
    const truncatedLicense = normalizedLicense.slice(0, maxUserLicenseApiNameLength);
    // API名へ組み込める正規化済みUser Licenseを返す。
    return truncatedLicense;
}

// 汎用Permission Setへ移行できないGuest User Licenseを表記差を除いて判定する。
function isGuestUserLicense(userLicense) {
    if (typeof userLicense !== 'string') {
        return false;
    }

    const normalizedLicense = userLicense
        .normalize('NFKC')
        .replace(/[^A-Za-z]/gu, '')
        .toLowerCase();
    return guestUserLicenseKeys.has(normalizedLicense);
}

// Permission Setでアプリケーション権限を保持できないChatter系User Licenseを表記差を除いて判定する。
function isChatterUserLicense(userLicense) {
    if (typeof userLicense !== 'string') {
        return false;
    }

    const normalizedLicense = userLicense
        .normalize('NFKC')
        .replace(/[^A-Za-z]/gu, '')
        .toLowerCase();
    return chatterUserLicenseKeys.has(normalizedLicense);
}

// 汎用Permission Setへの変換対象外となるUser Licenseの理由を返す。
function getExcludedUserLicenseReason(userLicense) {
    if (isGuestUserLicense(userLicense)) {
        return 'Guest User Licenseは汎用Permission Setへの移行対象外です。';
    }

    if (isChatterUserLicense(userLicense)) {
        return 'Chatter系User Licenseは汎用Permission Setへの移行対象外です。';
    }

    return undefined;
}

// User License、実行日時、Profile連番からデプロイ後の確認用の一意な仮API名を作る。
function createTemporaryPermissionSetApiName({ runIdentifier, sequence, userLicense }) {
    if (typeof runIdentifier !== 'string' || !/^\d{8}-\d{6}-\d{3}(?:-\d{4})?$/u.test(runIdentifier)) {
        throw new Error('仮API名へ使用する実行識別子が不正です。');
    }

    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 9_999) {
        throw new Error('仮API名へ使用するProfile連番は1以上9999以下の整数で指定してください。');
    }

    // 元ProfileのUser LicenseをAPI名で使用できる形式へ揃える。
    const normalizedLicense = normalizeUserLicenseForApiName(userLicense);
    // 出力フォルダと同じ実行日時をAPI名で使用できる形式へ揃える。
    const normalizedRunIdentifier = runIdentifier.replaceAll('-', '_');
    // 同じUser LicenseのProfileが複数ある場合も衝突しない連番を作る。
    const profileSequence = String(sequence).padStart(4, '0');
    // 命名規則どおりの仮API名を組み立てる。
    const candidate = `ProfileConversion_${normalizedLicense}_${normalizedRunIdentifier}_${profileSequence}`;

    // SalesforceのPermission Set API名制約を満たさない候補は書き込まない。
    validatePermissionSetApiName(candidate);
    // 検証済みの仮API名を返す。
    return candidate;
}

// Profile metadata fullNameへ実行識別子と連番を加え、一意なPermission Setラベルを作る。
function createPermissionSetLabel({ profileFullName, runIdentifier, sequence }) {
    if (typeof profileFullName !== 'string' || profileFullName.trim() === '') {
        throw new Error('Permission Setラベルに使用するProfile metadata fullNameを指定してください。');
    }

    if (typeof runIdentifier !== 'string' || !/^\d{8}-\d{6}-\d{3}(?:-\d{4})?$/u.test(runIdentifier)) {
        throw new Error('Permission Setラベルへ使用する実行識別子が不正です。');
    }

    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 9_999) {
        throw new Error('Permission Setラベルへ使用するProfile連番は1以上9999以下の整数で指定してください。');
    }

    const normalizedProfileFullName = profileFullName.trim().normalize('NFC');
    const profileSequence = String(sequence).padStart(4, '0');
    const uniqueSuffix = ` ${runIdentifier} ${profileSequence}`;
    const profileNameLength = 80 - uniqueSuffix.length;
    const profileName = normalizedProfileFullName.slice(0, profileNameLength).trimEnd();
    const label = `${profileName}${uniqueSuffix}`;

    return label;
}

module.exports = {
    createPermissionSetLabel,
    createTemporaryPermissionSetApiName,
    decodeProfileFileName,
    getExcludedUserLicenseReason,
    isChatterUserLicense,
    isGuestUserLicense,
    maxUserLicenseApiNameLength,
    normalizeUserLicenseForApiName,
    profileFileSuffix
};
