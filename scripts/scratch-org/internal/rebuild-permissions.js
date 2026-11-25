// 用途: Scratch Org の機能と外部認証の構築範囲に合わせて、一時パッケージ内の権限を調整する。
const fs = require('node:fs');
const path = require('node:path');
const { XMLBuilder, XMLParser } = require('fast-xml-parser');
const { parseSfJson } = require('../../common/target-org');
const { repoRoot } = require('./context');

// XML の文字列、名前空間、宣言を維持する。
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, ignoreDeclaration: false });
// 変更は scratch への送信用ファイルだけに書き戻す。
const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
// 通常は OAuth と同時に反映する画面の権限セット。
const appSets = ['LwcExternalClientAppManager', 'LwcObjectExplorer'];

// 作成時の設定ファイルではなく、実際の割り当て先組織で個人取引先を判定する。
function hasPersonAccounts(username, runSfQuery) {
    // 項目の存在だけを問い合わせ、取引先レコードにはアクセスしない。
    const result = parseSfJson(
        runSfQuery(
            [
                'data',
                'query',
                '--use-tooling-api',
                '--query',
                "SELECT QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account' AND QualifiedApiName = 'IsPersonAccount'",
                '--target-org',
                username,
                '--json'
            ],
            repoRoot
        ),
        '個人取引先の確認'
    );
    // 問い合わせ失敗や欠けた応答を機能無効とみなさない。
    if (
        !Array.isArray(result?.records) ||
        result.records.length !== result.totalSize ||
        result.totalSize > 1 ||
        result.records.some((field) => field.QualifiedApiName !== 'IsPersonAccount')
    )
        throw new Error('取引先の項目定義を確認できません。');
    // 個人取引先の標準項目がある場合だけ依存権限を補う。
    return result.totalSize === 1;
}

// アプリの枠だけの場合は、画面権限を初期反映の対象に加える。
function addAppSets(manifest, destination) {
    // OAuth を含まない初期 manifest の対象だけを引き継ぐ。
    const document = parser.parse(fs.readFileSync(manifest, 'utf8'));
    // 既存の権限セット一覧に、今回必要な2件だけを加える。
    const sets = document.Package.types.find((type) => type.name === 'PermissionSet');
    // 同一権限セットを二重登録しない。
    sets.members = [...new Set([sets.members, appSets].flat())];
    // Salesforce CLI はこの一時 manifest を変換対象として使用する。
    fs.writeFileSync(destination, builder.build(document));
}

// Metadata API 形式に変換済みの権限セットだけを加工する。
function preparePermissions(directory, personAccounts, shellsOnly) {
    // 対象パッケージの権限セットに限定する。
    const folder = path.join(directory, 'permissionsets');
    // パッケージに含まれる権限だけを調整する。
    for (const file of fs.readdirSync(folder).filter((name) => name.endsWith('.permissionset'))) {
        // 配備用のコピーから既存のアクセスを保持する。
        const filename = path.join(folder, file);
        // XML の属性と文字列値を保持して読み込む。
        const document = parser.parse(fs.readFileSync(filename, 'utf8'));
        // 他の権限やメタデータは元の内容を保持する。
        const set = document.PermissionSet;
        // 単数定義でも既存のオブジェクト権限を検索できるようにする。
        const objects = [set.objectPermissions ?? []].flat();
        // 既存の取引先責任者権限への追加では、他の権限を縮小しない。
        const contact = objects.find((item) => item.object === 'Contact');
        // 個人取引先の必要条件に該当するものだけ対象にする。
        const needsRead =
            personAccounts &&
            contact?.allowRead !== 'true' &&
            objects.some((item) => item.object === 'Account' && item.allowRead === 'true');
        // OAuth を使う経路では元のプリンシパルへのアクセスを維持する。
        const omitPrincipal =
            shellsOnly &&
            appSets.includes(path.basename(file, '.permissionset')) &&
            set.externalCredentialPrincipalAccesses;
        // 差分が不要なファイルは変換直後の状態で送信する。
        if (!needsRead && !omitPrincipal) continue;
        // 読み取り依存だけを補い、編集・削除などの追加を避ける。
        if (needsRead) {
            // 既存項目があれば参照フラグだけを変更する。
            if (contact) contact.allowRead = 'true';
            // 新規項目は参照だけを許可する。
            else
                objects.push({
                    allowCreate: 'false',
                    allowDelete: 'false',
                    allowEdit: 'false',
                    allowRead: 'true',
                    modifyAllRecords: 'false',
                    object: 'Contact',
                    viewAllRecords: 'false'
                });
            // 元の位置で権限一覧を更新する。
            set.objectPermissions = objects;
        }
        // 枠のみの構築では未作成の外部認証への参照を含めない。
        if (omitPrincipal) delete set.externalCredentialPrincipalAccesses;
        // 検証した変更を一時パッケージだけに保存する。
        fs.writeFileSync(filename, builder.build(document));
    }
}

module.exports = { addAppSets, hasPersonAccounts, preparePermissions };
