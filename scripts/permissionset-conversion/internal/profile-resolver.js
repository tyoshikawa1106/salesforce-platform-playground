// 実行方法: ProfileからPermission Setを生成する入口スクリプトから読み込む。
// 用途: ローカルProfile sourceファイル名をmetadata fullNameとPermission Set名へ変換する。

const { validatePermissionSetApiName } = require('./profile-converter');

// 入力Profileのsource形式を識別する。
const profileFileSuffix = '.profile-meta.xml';
// 実行日時と連番を含めてもAPI名の80文字上限へ収める。
const maxUserLicenseApiNameLength = 32;
// 変換対象外とするGuestの表記を限定する。
const guestUserLicenseKeys = new Set(['guestuserlicense', 'guestuserlicence']);

// Salesforce source形式のpercent encodingを1回だけ戻し、論理fullNameとして正規化する。
function decodeProfileFullName(encodedName, sourceDescription) {
    // 不正なpercent encodingを入力エラーとして扱う。
    try {
        // source形式の表記差だけを戻し、Profile名を推測しない。
        return decodeURIComponent(encodedName).normalize('NFC');
    } catch (error) {
        // 失敗した入力の種類とデコードエラーを伝える。
        throw new Error(`${sourceDescription}をデコードできません: ${encodedName}: ${error.message}`);
    }
}

// Profile sourceファイル名を検証し、接尾辞を除いた論理fullNameへ変換する。
function decodeProfileFileName(fileName) {
    // Profile以外のファイルをmetadata名へ変換しない。
    if (typeof fileName !== 'string' || !fileName.endsWith(profileFileSuffix)) {
        // 入力ファイル名の形式誤りを通知する。
        throw new Error(`Profile metadataのファイル名が不正です: ${fileName}`);
    }

    // source形式の拡張子だけを取り除く。
    const encodedName = fileName.slice(0, -profileFileSuffix.length);

    // 表記を正規化したmetadata fullNameを返す。
    return decodeProfileFullName(encodedName, 'Profile metadataのファイル名');
}

// User LicenseをPermission Set API名で使用できる英数字だけへ正規化する。
function normalizeUserLicenseForApiName(userLicense) {
    // 元ProfileにUser Licenseがない状態では命名規則を成立させない。
    if (typeof userLicense !== 'string' || userLicense.trim() === '') {
        // 不明なライセンスから仮名を作らない。
        throw new Error('仮API名へ使用する元ProfileのUser Licenseを指定してください。');
    }

    // API名の区切りと混同しないよう、User License内の空白と記号を除去する。
    const normalizedLicense = userLicense
        .trim()
        .normalize('NFKC')
        .replace(/[^A-Za-z0-9]+/gu, '');

    // 変換後に識別文字が残らないUser Licenseは推測で命名しない。
    if (normalizedLicense === '') {
        // 識別不能なライセンスに代替名を割り当てない。
        throw new Error(`元ProfileのUser LicenseをPermission Set API名へ変換できません: ${userLicense}`);
    }

    // 日時、出力重複連番、Profile連番を含めてもAPI名が80文字以内になる長さへ制限する。
    const truncatedLicense = normalizedLicense.slice(0, maxUserLicenseApiNameLength);
    // API名へ組み込める正規化済みUser Licenseを返す。
    return truncatedLicense;
}

// 本スクリプトで変換対象外とするGuest User Licenseを識別する。
function isGuestUserLicense(userLicense) {
    // 不明な値を除外対象ライセンスと推測しない。
    if (typeof userLicense !== 'string') {
        // 入力形式の検証は呼び出し側に委ねる。
        return false;
    }

    // 表記差だけを除き、ライセンス名全体を照合する。
    const normalizedLicense = userLicense
        .normalize('NFKC')
        .replace(/[^A-Za-z]/gu, '')
        .toLowerCase();
    // 製品固有のGuestライセンスを巻き込まず完全一致だけを返す。
    return guestUserLicenseKeys.has(normalizedLicense);
}

// Salesforce全般の技術的不可能と混同せず、本スクリプトの対応範囲を説明する。
function getExcludedUserLicenseReason(userLicense) {
    // Guest向けの個別Permission Set作成とProfile全体の変換を区別する。
    if (isGuestUserLicense(userLicense)) {
        // 対応範囲外であることだけを簡潔に伝える。
        return 'Guest User Licenseは本スクリプトの変換対象外です。';
    }

    // 除外理由がない場合は通常の要素単位の変換検証へ進める。
    return undefined;
}

// User License、実行日時、Profile連番からデプロイ後の確認用の一意な仮API名を作る。
function createTemporaryPermissionSetApiName({ runIdentifier, sequence, userLicense }) {
    // 出力フォルダと一致する実行識別子だけを使用する。
    if (typeof runIdentifier !== 'string' || !/^\d{8}-\d{6}-\d{3}(?:-\d{4})?$/u.test(runIdentifier)) {
        // 不正な実行識別子によるAPI名を生成しない。
        throw new Error('仮API名へ使用する実行識別子が不正です。');
    }

    // API名とラベルの対応を保つため同じ4桁の連番範囲を要求する。
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 9_999) {
        // 桁あふれや重複し得る番号を拒否する。
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
    // 表示ラベルから元Profileを識別できる入力を必須にする。
    if (typeof profileFullName !== 'string' || profileFullName.trim() === '') {
        // 元Profileが分からないラベルを生成しない。
        throw new Error('Permission Setラベルに使用するProfile metadata fullNameを指定してください。');
    }

    // 出力フォルダと一致する実行識別子だけを使用する。
    if (typeof runIdentifier !== 'string' || !/^\d{8}-\d{6}-\d{3}(?:-\d{4})?$/u.test(runIdentifier)) {
        // 日時形式でない実行識別子を拒否する。
        throw new Error('Permission Setラベルへ使用する実行識別子が不正です。');
    }

    // API名とラベルの対応を保つため同じ4桁の連番範囲を要求する。
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 9_999) {
        // API名に対応できない連番を拒否する。
        throw new Error('Permission Setラベルへ使用するProfile連番は1以上9999以下の整数で指定してください。');
    }

    // Unicode表記と周辺空白を揃える。
    const normalizedProfileFullName = profileFullName.trim().normalize('NFC');
    // API名と同じ4桁の連番を表示する。
    const profileSequence = String(sequence).padStart(4, '0');
    // 一意性を保つ末尾は短縮せずに残す。
    const uniqueSuffix = ` ${runIdentifier} ${profileSequence}`;
    // ラベルの80文字上限からProfile名に使える長さを決める。
    const profileNameLength = 80 - uniqueSuffix.length;
    // 長いProfile名だけを短縮する。
    const profileName = normalizedProfileFullName.slice(0, profileNameLength).trimEnd();
    // 一意性と元Profileの識別性を両立したラベルを組み立てる。
    const label = `${profileName}${uniqueSuffix}`;

    // 制約を満たす表示ラベルを返す。
    return label;
}

module.exports = {
    createPermissionSetLabel,
    createTemporaryPermissionSetApiName,
    decodeProfileFileName,
    getExcludedUserLicenseReason,
    isGuestUserLicense,
    maxUserLicenseApiNameLength,
    normalizeUserLicenseForApiName,
    profileFileSuffix
};
