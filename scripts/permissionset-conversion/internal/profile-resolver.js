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

// fullNameがAPI名制約を満たさない場合だけ、ASCII片と短いhashから安定した名前を作る。
function createPermissionSetApiName(profileFullName) {
    const normalizedFullName = profileFullName.normalize('NFC');

    try {
        validatePermissionSetApiName(normalizedFullName);
        return normalizedFullName;
    } catch {
        const hash = crypto.createHash('sha256').update(normalizedFullName).digest('hex').slice(0, 10).toUpperCase();
        const normalizedAscii = normalizedFullName
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/_+/g, '_');
        const safeBase = /^[A-Za-z]/.test(normalizedAscii) ? normalizedAscii : `Profile_${normalizedAscii}`;
        const base = safeBase.replace(/_+$/g, '') || 'Profile';
        const candidate = `${base.slice(0, 69).replace(/_+$/g, '')}_${hash}`;

        validatePermissionSetApiName(candidate);
        return candidate;
    }
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
    createPermissionSetApiName,
    createPermissionSetLabel,
    decodeProfileFileName,
    profileFileSuffix
};
