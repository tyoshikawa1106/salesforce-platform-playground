// 実行方法: Permission Setの生成と保存結果比較モジュールから読み込む。
// 用途: Permission Set metadataの繰り返し要素と識別子を一箇所で管理する。

// Permission Set metadataの繰り返し要素を、各要素の一意な識別子へ対応付ける。
const collectionIdentifiers = new Map([
    ['agentAccesses', 'agentName'],
    ['classAccesses', 'apexClass'],
    ['customMetadataTypeAccesses', 'name'],
    ['customPermissions', 'name'],
    ['customSettingAccesses', 'name'],
    ['externalDataSourceAccesses', 'externalDataSource'],
    ['fieldPermissions', 'field'],
    ['flowAccesses', 'flow'],
    ['genComputingSummaryDefAccesses', 'configName'],
    ['objectPermissions', 'object'],
    ['pageAccesses', 'apexPage'],
    ['recordTypeVisibilities', 'recordType'],
    ['servicePresenceStatusAccesses', 'servicePresenceStatus'],
    ['tabSettings', 'tab'],
    ['userPermissions', 'name']
]);

module.exports = {
    collectionIdentifiers
};
