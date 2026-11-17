// 用途: 一時ディレクトリのECAパッケージを対象Scratch Org向けに準備する。

const { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { XMLBuilder, XMLParser } = require('fast-xml-parser');

const namespace = 'http://soap.sforce.com/2006/04/metadata';
const placeholder = 'https://scratch-org.example.invalid';
// 識別子と真偽値の表記を保ち、属性を消さずに組織固有値だけ変更する。
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, ignoreDeclaration: false });
// 変更する値をXMLエスケープし、元の属性を保持して出力する。
const builder = new XMLBuilder({ ignoreAttributes: false, format: true });

// Metadata API形式の指定typeを読み、ファイル名と関連参照を分離して扱う。
function readComponents(directory, folder, suffix, type) {
    // OAuthや認証プロバイダーを持たない構成でも空のtypeとして扱う。
    const parent = path.join(directory, folder);
    // 未定義のtypeはファイルを作らず、空の構成として返す。
    if (!existsSync(parent)) return [];
    // 指定したtypeのファイル以外を変換対象へ混ぜない。
    return readdirSync(parent)
        .filter((file) => file.endsWith(`.${suffix}`))
        .sort()
        .map((file) => {
            // XML文書全体を保持し、更新時に他の設定を落とさない。
            const filepath = path.join(parent, file);
            // 型名と名前空間を確認できる形で文書を解析する。
            const document = parser.parse(readFileSync(filepath, 'utf8'));
            // 他typeや名前空間のファイルを誤って書き換えない。
            if (!document[type] || document[type]['@_xmlns'] !== namespace) {
                // 不正な文書は組織へ送信せず停止する。
                throw new Error(`${type}のメタデータ形式が不正です。`);
            }
            // 参照用のAPI名と更新用の文書を一緒に返す。
            return { name: file.slice(0, -suffix.length - 1), filepath, document, fields: document[type] };
        });
}

// 関連する全定義を検証した後、組織固有値の設定と段階別パッケージの作成を行う。
function prepareEcaPackage(directory, { username, adminProfileName, instanceUrl, providerApps, appLabels = {} }) {
    // プロバイダー名とECA名の対応は非機密の設定から取得する。
    if (!providerApps || typeof providerApps !== 'object' || Array.isArray(providerApps)) {
        // 関連を推測した登録を防ぐ。
        throw new Error('外部認証プロバイダーとECAの対応設定が不正です。');
    }
    // ECA以外のtype名が同じであるとは仮定せず、XML内の参照で照合する。
    const apps = readComponents(directory, 'externalClientApps', 'eca', 'ExternalClientApplication');
    // OAuthの有効化と接続先を全アプリ分読み込む。
    const globals = readComponents(
        directory,
        'extlClntAppGlobalOauthSets',
        'ecaGlblOauth',
        'ExtlClntAppGlobalOauthSettings'
    );
    // スコープなどのアプリ設定を全件照合する。
    const settings = readComponents(directory, 'extlClntAppOauthSettings', 'ecaOauth', 'ExtlClntAppOauthSettings');
    // Run Asと事前承認の反映対象を収集する。
    const policies = readComponents(
        directory,
        'extlClntAppOauthPolicies',
        'ecaOauthPlcy',
        'ExtlClntAppOauthConfigurablePolicies'
    );
    // 同一組織への認証に使う全プロバイダーを収集する。
    const providers = readComponents(
        directory,
        'externalAuthIdentityProviders',
        'externalAuthIdentityProvider',
        'ExternalAuthIdentityProvider'
    );
    // プリンシパルとプロバイダーの関連を読み込む。
    const credentials = readComponents(directory, 'externalCredentials', 'externalCredential', 'ExternalCredential');
    // callout先と外部ログイン情報の関連を読み込む。
    const namedCredentials = readComponents(directory, 'namedCredentials', 'namedCredential', 'NamedCredential');
    // Local以外を新組織用の独立アプリとして扱わない。
    if (apps.some(({ fields }) => fields.distributionState !== 'Local')) {
        // 配信済みアプリの共有設定へ干渉する反映を防ぐ。
        throw new Error('Scratch OrgのECA定義はLocalである必要があります。');
    }
    // 組織スコープ付き識別子はScratch Org側で発行する。
    for (const { fields } of apps) delete fields.orgScopedExternalApp;
    // 参照先の欠落と重複を、組織へ送信する前に検出する。
    const appNames = new Set(apps.map(({ name }) => name));
    for (const [name, label] of Object.entries(appLabels)) {
        const app = apps.find((component) => component.name === name);
        if (!app || typeof label !== 'string' || !label.trim()) {
            throw new Error('Scratch Org向けECA表示名の対象または値が不正です。');
        }
        app.fields.label = label;
    }
    // typeごとに、各ECAへ一つの設定が対応することを確認する。
    for (const components of [globals, settings, policies]) {
        // ファイル名でなく、定義が指定するECAを使う。
        const references = components.map(({ fields }) => fields.externalClientApplication);
        // 存在しないアプリや複数設定への誤反映を防ぐ。
        if (references.some((name) => !appNames.has(name)) || new Set(references).size !== references.length) {
            // 参照関係を修正してから再実行できるよう停止する。
            throw new Error('ECA設定の参照先が欠落または重複しています。');
        }
    }
    // OAuth設定とポリシーから、対応するグローバル設定の欠落も検出する。
    const oauthApps = new Set(globals.map(({ fields }) => fields.externalClientApplication));
    // 一方向の照合だけで、孤立した設定を見落とさない。
    if ([...settings, ...policies].some(({ fields }) => !oauthApps.has(fields.externalClientApplication))) {
        // Salesforceによる意図しない既定設定の生成を防ぐ。
        throw new Error('ECAのグローバルOAuth設定が不足しています。');
    }
    // OAuth有効アプリについて設定とポリシーの組が揃っていることを要求する。
    for (const global of globals) {
        // アプリの関連先を基準に設定を突き合わせる。
        const name = global.fields.externalClientApplication;
        // OAuth設定に対応する管理ポリシーを確認する。
        const policy = policies.find(({ fields }) => fields.externalClientApplication === name);
        // OAuth機能の片側だけを反映しない。
        if (!policy || !settings.some(({ fields }) => fields.externalClientApplication === name)) {
            // 欠落している関連設定を利用者へ示す。
            throw new Error(`${name}のOAuth設定またはポリシーが不足しています。`);
        }
        // Flow有効化の片側だけが変わっている定義を拒否する。
        if (
            (global.fields.isClientCredentialsFlowEnabled === 'true') !==
            (policy.fields.isClientCredentialsFlowEnabled === 'true')
        ) {
            // 無効化への補正を行わず、設定の矛盾を報告する。
            throw new Error(`${name}のClient Credentials Flow設定が一致しません。`);
        }
        // コピーから取得元のコンシューマー識別子を取り除き、新組織で発行する。
        delete global.fields.consumerKey;
        delete global.fields.consumerSecret;
    }
    for (const { fields } of settings) {
        delete fields.oauthLink;
    }
    // 設定された対応とパッケージのプロバイダーを双方向に照合する。
    const providerNames = providers.map(({ name }) => name);
    // 名前と件数の両方を比較して対応漏れを検出する。
    if (JSON.stringify(Object.keys(providerApps).sort()) !== JSON.stringify(providerNames.sort())) {
        // 一部のプロバイダーだけが未設定の状態を防ぐ。
        throw new Error('全認証プロバイダーとECAの対応設定を確認してください。');
    }
    const providerOrigins = new Map();
    const providerEndpoints = new Map([
        ['AuthorizeUrl', '/services/oauth2/authorize'],
        ['TokenUrl', '/services/oauth2/token']
    ]);
    for (const { name, fields } of providers) {
        const app = providerApps[name];
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || !appNames.has(app)) {
            throw new Error('認証プロバイダーに対応するECAがありません。');
        }
        const parameters = [fields.externalAuthIdentityProviderParameters ?? []].flat();
        const endpoints = [...providerEndpoints].map(([type, endpoint]) => {
            const matches = parameters.filter((parameter) => parameter.parameterType === type);
            const value = matches[0]?.parameterValue;
            const url = typeof value === 'string' ? URL.parse(value) : null;
            if (
                matches.length !== 1 ||
                !url ||
                (url.origin !== placeholder && !/^https:\/\/[a-z0-9.-]+\.my\.salesforce\.com$/.test(url.origin)) ||
                value !== url.origin + endpoint
            ) {
                throw new Error('認証プロバイダーの接続先を同じScratch Orgに変換できません。');
            }
            return { parameter: matches[0], endpoint, origin: url.origin };
        });
        const [authorize, token] = endpoints;
        if (authorize.origin !== token.origin) {
            throw new Error('認証プロバイダーの認可先とトークン発行先が一致しません。');
        }
        providerOrigins.set(name, authorize.origin);
        for (const { parameter, endpoint } of endpoints) {
            parameter.parameterValue = instanceUrl + endpoint;
        }

        const global = globals.find(({ fields }) => fields.externalClientApplication === app)?.fields;
        const callbackPath = '/services/extidp/callback';
        if (global?.callbackUrl !== authorize.origin + callbackPath) {
            throw new Error('組織内ECAのコールバックURLと認証プロバイダーの接続先が一致しません。');
        }
        global.callbackUrl = instanceUrl + callbackPath;
    }
    const credentialOrigins = new Map();
    // 全プリンシパルをメタデータから読み、追加・削除を権限に反映する。
    const principalAccesses = credentials.flatMap(({ name, fields }) => {
        const parameters = [fields.externalCredentialParameters ?? []].flat();
        const references = parameters.filter((parameter) => parameter.externalAuthIdentityProvider);
        const origin = providerOrigins.get(references[0]?.externalAuthIdentityProvider);
        if (references.length !== 1 || !origin) {
            throw new Error('外部ログイン情報の認証プロバイダー参照を確認してください。');
        }
        credentialOrigins.set(name, origin);
        return parameters
            .filter((parameter) => ['PerUserPrincipal', 'NamedPrincipal'].includes(parameter.parameterType))
            .map((parameter) => ({ enabled: true, externalCredentialPrincipal: `${name}-${parameter.parameterName}` }));
    });
    for (const { fields } of namedCredentials) {
        const parameters = [fields.namedCredentialParameters ?? []].flat();
        const references = parameters.filter((parameter) => parameter.externalCredential);
        const origin = credentialOrigins.get(references[0]?.externalCredential);
        if (references.length !== 1 || !origin) {
            throw new Error('指定ログイン情報の外部ログイン情報参照を確認してください。');
        }
        const urls = parameters.filter((parameter) => parameter.parameterType === 'Url');
        if (urls.length !== 1 || urls[0].parameterValue !== origin) {
            throw new Error('指定ログイン情報と認証プロバイダーの接続先が一致しません。');
        }
        urls[0].parameterValue = instanceUrl;
    }
    for (const { filepath, document } of [...apps, ...globals, ...settings, ...providers, ...namedCredentials]) {
        writeFileSync(filepath, builder.build(document));
    }
    // 有効な全Client Credentials Flowの実行者を、作成管理者へ置換する。
    for (const policy of policies) {
        // 有効なFlowだけにRun Asを指定する。
        if (policy.fields.isClientCredentialsFlowEnabled === 'true') {
            // Scratch Orgで生成された作成管理者を使用する。
            policy.fields.clientCredentialsFlowUser = username;
        } else {
            // 無効なFlowに取得元ユーザー参照を残さない。
            delete policy.fields.clientCredentialsFlowUser;
        }
        // 事前承認型のアプリを作成管理者で使用可能にする。
        if (
            policy.fields.permittedUsersPolicyType === 'AdminApprovedPreAuthorized' &&
            (policy.fields.commaSeparatedProfile ||
                policy.fields.commaSeparatedPermissionSet ||
                policy.fields.isClientCredentialsFlowEnabled === 'true')
        ) {
            // 元組織のプロファイル割り当てを作成管理者へ置き換える。
            policy.fields.commaSeparatedProfile = adminProfileName;
            // 元組織の権限セットIDを持ち込まない。
            delete policy.fields.commaSeparatedPermissionSet;
        }
        // アプリごとに反映用のポリシーを保存する。
        writeFileSync(policy.filepath, builder.build(policy.document));
    }
    // 権限セットの他の設定を維持し、プリンシパル利用権限だけ再生成する。
    const permissionPath = path.join(directory, 'permissionsets/ScratchOrgExternalCredentialAccess.permissionset');
    // ラベルなどの既存設定を引き継ぐ。
    const permissionDocument = parser.parse(readFileSync(permissionPath, 'utf8'));
    // 削除したプリンシパルの権限も残さない。
    permissionDocument.PermissionSet.externalCredentialPrincipalAccesses = principalAccesses;
    // 権限の組織依存差分を一時成果物へ限定する。
    writeFileSync(permissionPath, builder.build(permissionDocument));
    // SalesforceがECA作成時にポリシーを生成するため、ポリシーの反映を後段に分ける。
    const manifestPath = path.join(directory, 'package.xml');
    // 元のAPIバージョンとスコープを保持する。
    const manifest = parser.parse(readFileSync(manifestPath, 'utf8'));
    // typeが一件の場合も段階別に分割できる形へ揃える。
    const types = [manifest.Package.types ?? []].flat();
    // 後段へ送るのはOAuthポリシーだけとする。
    const policyTypes = types.filter((type) => type.name === 'ExtlClntAppOauthConfigurablePolicies');
    // 本体パッケージへ入れ子のパッケージを混ぜない。
    const policyDirectory = path.join(path.dirname(directory), 'policies');
    // 実行ごとの一時ルート内に後段用の保存先を作る。
    mkdirSync(policyDirectory);
    // ポリシー未定義の構成では移動を行わない。
    if (policies.length > 0)
        renameSync(
            path.join(directory, 'extlClntAppOauthPolicies'),
            path.join(policyDirectory, 'extlClntAppOauthPolicies')
        );
    // 後段はポリシーのみを対象とするmanifestで反映する。
    writeFileSync(
        path.join(policyDirectory, 'package.xml'),
        builder.build({ ...manifest, Package: { ...manifest.Package, types: policyTypes } })
    );
    // 本体作成の要求から生成前のポリシーを除く。
    manifest.Package.types = types.filter((type) => type.name !== 'ExtlClntAppOauthConfigurablePolicies');
    // 元manifestの他のtypeは範囲を変えず保持する。
    writeFileSync(manifestPath, builder.build(manifest));
    // 呼び出し元は対象数に依存せず、基本設定、ポリシーの順に反映する。
    return { policyDirectory, hasPolicies: policies.length > 0 };
}

// 組織が生成したポリシー名を、ECA参照で照合して後段の反映対象へ適用する。
function resolvePolicyNames(policyDirectory, retrievedDirectory) {
    // ポリシーだけを取得した一時領域から、API形式の実ファイルを列挙する。
    const files = readdirSync(retrievedDirectory, { recursive: true }).filter((file) => file.endsWith('.ecaOauthPlcy'));
    // 名前を組み立てる慣習ではなく、実際の生成結果を使用する。
    const generated = files.map((file) => {
        // 関連アプリの参照を読み、取得結果から組織固有値をログへ出さない。
        const document = parser.parse(readFileSync(path.join(retrievedDirectory, file), 'utf8'));
        // ファイル名だけをmetadata fullNameとして扱う。
        return {
            name: path.basename(file, '.ecaOauthPlcy'),
            app: document.ExtlClntAppOauthConfigurablePolicies?.externalClientApplication
        };
    });
    // 反映予定のポリシーを全件照合してから、ファイルの入れ替えを開始する。
    const policies = readComponents(
        policyDirectory,
        'extlClntAppOauthPolicies',
        'ecaOauthPlcy',
        'ExtlClntAppOauthConfigurablePolicies'
    );
    // 取得結果に含まれる無関係なアプリは反映範囲へ追加しない。
    const resolved = policies.map((policy) => {
        // アプリ参照が一意に一致する生成済みポリシーを探す。
        const matches = generated.filter(({ app }) => app === policy.fields.externalClientApplication);
        // 名前の不明・重複状態ではポリシーを作り直さない。
        if (matches.length !== 1 || !/^[A-Za-z][A-Za-z0-9_]*$/.test(matches[0].name)) {
            // 対象組織の生成完了を確認できない状態で後続へ進まない。
            throw new Error('Scratch Orgが生成したOAuthポリシーを一意に確認できません。');
        }
        // 元の設定と組織が生成したfullNameを対応付ける。
        return { ...policy, targetName: matches[0].name };
    });
    // 相互に名前が入れ替わる場合も上書きでファイルを失わないよう元ファイルを先に除く。
    for (const policy of resolved) unlinkSync(policy.filepath);
    // 各ポリシーの中身は維持し、更新先のfullNameだけを合わせる。
    for (const policy of resolved) {
        // 出力先は後段パッケージのポリシーディレクトリへ限定する。
        writeFileSync(
            path.join(policyDirectory, 'extlClntAppOauthPolicies', `${policy.targetName}.ecaOauthPlcy`),
            builder.build(policy.document)
        );
    }
    // ファイル名とmanifestのmemberを同じ照合結果から更新する。
    const manifestPath = path.join(policyDirectory, 'package.xml');
    // APIバージョンなどのpackage情報を保持する。
    const manifest = parser.parse(readFileSync(manifestPath, 'utf8'));
    // 反映するtypeを増やさず、生成済みの名前だけを列挙する。
    manifest.Package.types = [
        { members: resolved.map(({ targetName }) => targetName), name: 'ExtlClntAppOauthConfigurablePolicies' }
    ];
    // 検証済みの対象名で後段のdeployを実行できる状態にする。
    writeFileSync(manifestPath, builder.build(manifest));
}

module.exports = { prepareEcaPackage, resolvePolicyNames };
