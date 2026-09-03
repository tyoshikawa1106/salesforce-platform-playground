// 実行方法: ProfileからPermission Setを生成する入口スクリプトから読み込む。
// 用途: ローカルProfile sourceファイル名をmetadata fullNameとPermission Set名へ変換する。

const crypto = require('node:crypto');
const { validatePermissionSetApiName } = require('./profile-converter');

const profileFileSuffix = '.profile-meta.xml';

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

// 実行単位とProfileを識別できる、デプロイ後の確認用の一意な仮API名を作る。
function createTemporaryPermissionSetApiName({ profileFullName, runIdentifier, runNonce, sequence }) {
    if (typeof profileFullName !== 'string' || profileFullName.trim() === '') {
        throw new Error('仮API名へ使用するProfile metadata fullNameを指定してください。');
    }

    if (typeof runIdentifier !== 'string' || !/^\d{8}-\d{6}-\d{3}(?:-\d{4})?$/u.test(runIdentifier)) {
        throw new Error('仮API名へ使用する実行識別子が不正です。');
    }

    if (typeof runNonce !== 'string' || !/^[A-F0-9]{8}$/u.test(runNonce)) {
        throw new Error('仮API名へ使用する実行IDが不正です。');
    }

    if (!Number.isSafeInteger(sequence) || sequence < 1) {
        throw new Error('仮API名へ使用するProfile連番は1以上の整数で指定してください。');
    }

    const normalizedProfileName = profileFullName.trim().normalize('NFC');
    const profileHash = crypto
        .createHash('sha256')
        .update(normalizedProfileName)
        .digest('hex')
        .slice(0, 10)
        .toUpperCase();
    const normalizedRunIdentifier = runIdentifier.replaceAll('-', '_');
    const profileSequence = String(sequence).padStart(4, '0');
    const candidate = `ProfileConversion_${normalizedRunIdentifier}_${runNonce}_${profileSequence}_${profileHash}`;

    validatePermissionSetApiName(candidate);
    return candidate;
}

// 組織へ接続せず、Profile metadata fullNameをPermission Setラベルとして検証する。
function createPermissionSetLabel(profileFullName) {
    if (typeof profileFullName !== 'string' || profileFullName.trim() === '') {
        throw new Error('Permission Setラベルに使用するProfile metadata fullNameを指定してください。');
    }

    const label = profileFullName.trim().normalize('NFC');

    if (label.length > 80) {
        throw new Error(`Profile metadata fullNameを80文字以内のPermission Setラベルにできません: ${label}`);
    }

    return label;
}

module.exports = {
    createPermissionSetLabel,
    createTemporaryPermissionSetApiName,
    decodeProfileFileName,
    profileFileSuffix
};
