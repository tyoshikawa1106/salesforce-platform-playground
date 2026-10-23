// 実行方法: seed-org-explorer.jsとNodeテストから読み込む。
// 用途: IDを持たないデモ定義を検証し、投入用Apexと照合条件を組み立てる。
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

// 管理対象の識別子と、再現対象のユーザー項目を固定する。
const emailPattern = /^orgexplorer\.seed\.\d+@example\.com$/;
// 新規ユーザーへ設定し、保存後に照合する項目を固定する。
const userFields = [
    'FirstName',
    'LastName',
    'Alias',
    'Email',
    'Department',
    'Title',
    'Phone',
    'MobilePhone',
    'EmployeeNumber'
];
// 作成時に必須となる言語・地域設定を列挙する。
const settingFields = ['TimeZoneSidKey', 'LocaleSidKey', 'EmailEncodingKey', 'LanguageLocaleKey'];
// 実行場所に依存しないデータ定義の場所を使用する。
const planPath = path.resolve(__dirname, '../plans/org-explorer-demo.json');
// 定義と同じ版の匿名Apexを読み込む。
const templatePath = path.resolve(__dirname, '../../apex/test-data/seed-org-explorer.apexpart');

// 不完全な定義を投入前に検出する。
function requireValue(condition, message) {
    // 不完全なデータを組織へ送信する前に停止する。
    if (!condition) throw new Error(`デモ定義: ${message}`);
}

// 指定した項目以外を受け付けず、意図しない更新項目を混入させない。
function checkKeys(value, keys) {
    // 配列やnullをデータ定義として受け付けない。
    requireValue(value && typeof value === 'object' && !Array.isArray(value), 'オブジェクトが必要です。');
    // 未知の項目や項目漏れを投入前に拒否する。
    requireValue(
        Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)),
        '項目が一致しません。'
    );
}

// 親が先に現れる順へ並べ、参照漏れと循環を検出する。
function orderHierarchy(rows, keyField, parentField) {
    // 親子を識別するキーを一度だけ収集する。
    const identifiers = new Set(rows.map((row) => row[keyField]));
    // 親子を識別するキーが重複した定義を拒否する。
    requireValue(identifiers.size === rows.length, `${keyField}が重複しています。`);
    // 親から子へ投入する確定順を保持する。
    const ordered = [];
    // 参照先が確定した行だけを次の階層の親にする。
    const complete = new Set();
    // 全行の参照先が確定するまで階層単位で処理する。
    while (ordered.length < rows.length) {
        // 親が存在しない行と処理済みの親を持つ行を選ぶ。
        const ready = rows.filter(
            (row) => !complete.has(row[keyField]) && (row[parentField] === null || complete.has(row[parentField]))
        );
        // 参照漏れや循環で解決できない階層を拒否する。
        requireValue(ready.length > 0, `${parentField}に参照漏れまたは循環があります。`);
        // 同じ階層の行をまとめて確定する。
        for (const row of ready) {
            // 子が参照できる順序へ行を追加する。
            ordered.push(row);
            // 後続階層から親を参照できる状態にする。
            complete.add(row[keyField]);
        }
    }
    // 参照漏れと循環がない確定順だけを返す。
    return ordered;
}

// ロールとユーザーの対象範囲をローカルだけで確認する。
function validatePlan(plan) {
    // 定義にない項目を投入対象へ混入させない。
    checkKeys(plan, ['version', 'profileNames', 'userSettings', 'roles', 'users']);
    // 未対応の定義形式を誤って投入しない。
    requireValue(plan.version === 2, '未対応の版です。');
    // 標準プロファイルを日本語・英語の候補から解決できる状態にする。
    requireValue(
        Array.isArray(plan.profileNames) &&
            plan.profileNames.length === 2 &&
            plan.profileNames.every((name) => typeof name === 'string' && name.length > 0),
        '標準プロファイルの候補が必要です。'
    );
    // 定義にない項目を投入対象へ混入させない。
    checkKeys(plan.userSettings, settingFields);
    // 言語・地域設定が不足したユーザーを作成しない。
    requireValue(
        settingFields.every((key) => typeof plan.userSettings[key] === 'string' && plan.userSettings[key].length > 0),
        'ユーザー設定が必要です。'
    );
    // 空のロール定義と投入上限を超える定義を拒否する。
    requireValue(
        Array.isArray(plan.roles) && plan.roles.length > 0 && plan.roles.length <= 100,
        'ロールの件数が範囲外です。'
    );
    // 空のユーザー定義と投入上限を超える定義を拒否する。
    requireValue(
        Array.isArray(plan.users) && plan.users.length > 0 && plan.users.length <= 500,
        'ユーザーの件数が範囲外です。'
    );
    // ロールごとの識別子と親の形式を確認する。
    for (const row of plan.roles) {
        // 定義にない項目を投入対象へ混入させない。
        checkKeys(row, ['key', 'name', 'parent', 'previousKey']);
        // API名を英語の識別子形式と長さの範囲へ限定する。
        requireValue(
            typeof row.key === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(row.key) && row.key.length <= 80,
            'ロール識別名が不正です。'
        );
        // 表示名を必須とし、Salesforceの長さ制限へ合わせる。
        requireValue(
            typeof row.name === 'string' && row.name.length > 0 && row.name.length <= 80,
            'ロール名が不正です。'
        );
        // 親は未指定か定義上の識別名だけを受け付ける。
        requireValue(row.parent === null || typeof row.parent === 'string', '親ロールが不正です。');
    }
    // 旧名の照合をデモ専用の識別名へ限定する。
    requireValue(
        plan.roles.every(
            (row) =>
                row.previousKey === null ||
                (typeof row.previousKey === 'string' &&
                    /^OrgExplorerTest[A-Za-z0-9_]+$/.test(row.previousKey) &&
                    row.previousKey.length <= 80)
        ),
        '旧ロール識別名が不正です。'
    );
    // 新旧識別名を含めてロールの衝突を確認する。
    const lookupKeys = plan.roles.flatMap((row) => (row.previousKey === null ? [row.key] : [row.key, row.previousKey]));
    // 同じロールを新旧の識別名で二重に割り当てない。
    requireValue(
        new Set(lookupKeys.map((key) => key.toLowerCase())).size === lookupKeys.length,
        '新旧のロール識別名が重複しています。'
    );
    // 親から作成する順序へロールを正規化する。
    const roles = orderHierarchy(plan.roles, 'key', 'parent');
    // 会社を起点にした一つの階層として再現する。
    requireValue(roles.filter((row) => row.parent === null).length === 1, '最上位ロールは1つ必要です。');
    // ユーザーの所属先を定義内のロールへ限定する。
    const roleKeys = new Set(roles.map((row) => row.key));
    // デモの従業員番号もユーザー間で一意にする。
    const employeeNumbers = new Set();
    // 電話とモバイルを通した重複を検出する。
    const numbers = new Set();
    // 作成するユーザー項目と関連先を検証する。
    for (const row of plan.users) {
        // 定義にない項目を投入対象へ混入させない。
        checkKeys(row, [...userFields, 'role', 'manager']);
        // 必須の氏名・所属・連絡先を欠いたまま作成しない。
        requireValue(
            userFields.every((key) => typeof row[key] === 'string' && row[key].length > 0),
            'ユーザー項目が不足しています。'
        );
        // 管理対象のメールと有効な別名だけを許可する。
        requireValue(emailPattern.test(row.Email) && /^\w{1,8}$/.test(row.Alias), 'メールまたは別名が不正です。');
        // 実際の従業員番号と区別できる架空の番号だけを許可する。
        requireValue(
            /^DEMO-\d{6}$/.test(row.EmployeeNumber) && !employeeNumbers.has(row.EmployeeNumber),
            '従業員番号は重複しない架空番号が必要です。'
        );
        // 後続ユーザーとの重複を検出する。
        employeeNumbers.add(row.EmployeeNumber);
        // 氏名・部署・役職をSalesforceの長さ制限へ合わせる。
        requireValue(
            row.FirstName.length <= 40 &&
                row.LastName.length <= 80 &&
                row.Department.length <= 80 &&
                row.Title.length <= 80,
            'ユーザー項目の長さが範囲外です。'
        );
        // 定義外のロールを所属先として指定させない。
        requireValue(roleKeys.has(row.role), '所属ロールが定義されていません。');
        // 上司は未指定か識別用メールだけを受け付ける。
        requireValue(row.manager === null || typeof row.manager === 'string', '上司が不正です。');
        // 電話とモバイルに同じ架空番号の基準を適用する。
        for (const field of ['Phone', 'MobilePhone']) {
            // 架空番号の範囲外と重複した連絡先を拒否する。
            requireValue(
                /^\+1-(202|303|212|415|617|206)-555-01\d{2}$/.test(row[field]) && !numbers.has(row[field]),
                '電話番号は重複しない架空番号が必要です。'
            );
            // 他のユーザーや連絡先での同じ番号の使用を防ぐ。
            numbers.add(row[field]);
        }
    }
    // 上司のIDを先に解決できる順序へ並べる。
    const users = orderHierarchy(plan.users, 'Email', 'manager');
    // 上司階層を一人の起点から再現する。
    requireValue(users.filter((row) => row.manager === null).length === 1, '最上位ユーザーは1人必要です。');
    // 検証した内容を元の入力を変更せずに返す。
    return { ...plan, roles, users };
}

// ローカルの定義とApex断片を同じ検証経路で読み込む。
function readDefinition() {
    // ローカル定義を投入前と同じ基準で検証する。
    const plan = validatePlan(JSON.parse(fs.readFileSync(planPath, 'utf8')));
    // データを埋め込む匿名Apexの原本を読む。
    const template = fs.readFileSync(templatePath, 'utf8');
    // 差し込み位置が欠けたり重複した原本を投入しない。
    requireValue(template.split('__PAYLOAD__').length === 2, 'Apex断片の置換位置が不正です。');
    // 検証済み定義と投入原本を同時に渡す。
    return { plan, template };
}

// 全要求を接続前に合成し、上司が先に作成される順序で小分けにする。
function buildSources(plan, template, orgId) {
    // 対象組織を識別するID形式だけを要求へ埋め込む。
    requireValue(/^00D[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(orgId), '対象組織IDが不正です。');
    // 分割前に全定義の階層と識別子を一度だけ検証する。
    const validated = validatePlan(plan);
    // すべての要求で同じロール定義を使用し、繰り返す項目名を省く。
    const roles = validated.roles.map((row) => [row.key, row.name, row.parent, row.previousKey]);
    // 全対象の識別キーも分割前に一度だけ組み立てる。
    const userEmailKeys = validated.users.map((row) => row.Email.split('.')[2].split('@')[0]);
    // 32KiBの要求上限へ余裕を持たせて50ユーザーずつ送る。
    const sources = [];
    // 並列投入せず、先行する上司の作成を次の要求より先に完了できる順で返す。
    for (let offset = 0; offset < validated.users.length; offset += 50) {
        // 今回の分割だけを詳細データとして渡す。
        const users = validated.users
            .slice(offset, offset + 50)
            .map((row) => [...userFields.map((field) => row[field]), row.role, row.manager]);
        // 全体の管理対象を保持し、氏名などをApexコードへ直接埋め込まない。
        const payload = Buffer.from(JSON.stringify({ ...validated, roles, users, userEmailKeys, orgId })).toString(
            'base64'
        );
        // 読み込み時に検証した差し込み位置だけを置換する。
        const source = template.replace('__PAYLOAD__', payload);
        // どれか一つでも大き過ぎる場合は、一部の要求も投入しない。
        requireValue(Buffer.byteLength(source) <= 32768, '合成Apexが32KiBを超えています。');
        // 接続前にすべての要求を確定する。
        sources.push(source);
    }
    // 全要求のサイズ検証後にだけ実行へ進める。
    return sources;
}

// Salesforce応答から固有IDを除いてデータ定義と比較する。
function verifyRecords(plan, roles, users, baseline) {
    // 不足や重複を含む保存結果を成功として扱わない。
    requireValue(
        roles.length === plan.roles.length && users.length === plan.users.length,
        '投入後の件数が一致しません。'
    );
    // 旧API名の既存ロールも定義上の識別子へ対応付ける。
    const rolesById = new Map(
        roles.map((row) => [
            row.Id,
            plan.roles.find((expected) => [expected.key, expected.previousKey].includes(row.DeveloperName))?.key
        ])
    );
    // 組織固有IDを定義のメールキーへ対応付ける。
    const usersById = new Map(users.map((row) => [row.Id, row.Email]));
    // 全定義ロールの存在と保存後の内容を確認する。
    for (const expected of plan.roles) {
        // 新旧API名のどちらかで保存済みロールを特定する。
        const actual = roles.find((row) => [expected.key, expected.previousKey].includes(row.DeveloperName));
        // 再実行では既存ロールの保存前後が一致すれば、名称などの定義差を許容する。
        const previous = baseline?.roles.find((row) =>
            [expected.key, expected.previousKey].includes(row.DeveloperName)
        );
        // 既存データの意図しない変更だけを検知する。
        if (previous) {
            // 参照メタ情報を含めて同じ照会項目を比較する。
            requireValue(isDeepStrictEqual(actual, previous), '既存ロールが変更されています。');
            // 作成対象ではないため、定義値への一致は要求しない。
            continue;
        }
        // 新規ロールの名称と親子関係を定義と照合する。
        requireValue(
            actual?.Name === expected.name &&
                (rolesById.get(actual.ParentRoleId) ?? null) === expected.parent &&
                (!actual.ParentRoleId || rolesById.has(actual.ParentRoleId)),
            `ロールが一致しません: ${expected.key}`
        );
    }
    // 全定義ユーザーの存在と保存後の内容を確認する。
    for (const expected of plan.users) {
        // IDに依存せず識別用メールでユーザーを特定する。
        const actual = users.find((row) => row.Email === expected.Email);
        // 既存ユーザーは上司や所属を含めて保存前の状態を維持する。
        const previous = baseline?.users.find((row) => row.Email === expected.Email);
        // 既存データの変更がないことを確認する。
        if (previous) {
            // 再実行で既存ユーザーが変更されていれば失敗とする。
            requireValue(isDeepStrictEqual(actual, previous), '既存ユーザーが変更されています。');
            // 新規作成したユーザーだけを定義と厳密に照合する。
            continue;
        }
        // 新規ユーザーの氏名・所属・連絡先を定義と照合する。
        requireValue(
            actual && userFields.every((field) => actual[field] === expected[field]),
            `ユーザー項目が一致しません: ${expected.Email}`
        );
        // 新規ユーザーの無効状態と地域設定を照合する。
        requireValue(
            actual.IsActive === false && settingFields.every((field) => actual[field] === plan.userSettings[field]),
            `ユーザー設定が一致しません: ${expected.Email}`
        );
        // 新規ユーザーの所属と上司の参照先を照合する。
        requireValue(
            rolesById.get(actual.UserRoleId) === expected.role &&
                (usersById.get(actual.ManagerId) ?? null) === expected.manager &&
                (!actual.ManagerId || usersById.has(actual.ManagerId)),
            `所属または上司が一致しません: ${expected.Email}`
        );
        // 新規ユーザーのプロファイルとライセンスが定義どおりか確認する。
        requireValue(
            actual.Profile?.UserLicense?.Name === 'Salesforce' && plan.profileNames.includes(actual.Profile?.Name),
            '標準ユーザープロファイルが一致しません。'
        );
    }
    // 照合できた対象の件数だけを呼び出し元へ返す。
    return { roles: roles.length, users: users.length };
}

module.exports = {
    buildSources,
    readDefinition,
    settingFields,
    userFields,
    validatePlan,
    verifyRecords
};
