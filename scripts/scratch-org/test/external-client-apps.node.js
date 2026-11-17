const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, mkdirSync, readFileSync, copyFileSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { main } = require('../steps/deploy-external-client-apps');
const { scratchOrg, repoRoot } = require('../internal/context');
const { prepareEcaPackage } = require('../internal/eca-package');
const { registerProviderCredentials, requestScratchRest } = require('../internal/eca-provider-credentials');

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
const builder = new XMLBuilder({ ignoreAttributes: false });
const metadataTypes = {
    ExternalClientApplication: ['externalClientApps', 'eca'],
    ExtlClntAppGlobalOauthSettings: ['extlClntAppGlobalOauthSets', 'ecaGlblOauth'],
    ExtlClntAppOauthSettings: ['extlClntAppOauthSettings', 'ecaOauth'],
    ExtlClntAppOauthConfigurablePolicies: ['extlClntAppOauthPolicies', 'ecaOauthPlcy'],
    ExternalAuthIdentityProvider: ['externalAuthIdentityProviders', 'externalAuthIdentityProvider'],
    ExternalCredential: ['externalCredentials', 'externalCredential'],
    NamedCredential: ['namedCredentials', 'namedCredential'],
    PermissionSet: ['permissionsets', 'permissionset']
};

// ECAの実データを使わず、参照関係と境界条件だけをテスト用に組み立てる。
const ecaFixtureTypes = {
    ExternalClientApplication: () => ({ distributionState: 'Local' }),
    ExtlClntAppGlobalOauthSettings: (app) => ({
        externalClientApplication: app,
        isClientCredentialsFlowEnabled: String(['HerokuPlaygroundIntegration', 'SampleIntegration'].includes(app))
    }),
    ExtlClntAppOauthSettings: (app) => ({ externalClientApplication: app }),
    ExtlClntAppOauthConfigurablePolicies: (app) => ({
        externalClientApplication: app,
        isClientCredentialsFlowEnabled: String(['HerokuPlaygroundIntegration', 'SampleIntegration'].includes(app)),
        permittedUsersPolicyType: 'AdminApprovedPreAuthorized',
        refreshTokenPolicyType: 'Zero',
        requiredSessionLevel: 'HIGH_ASSURANCE'
    }),
    ExternalAuthIdentityProvider: () => ({
        externalAuthIdentityProviderParameters: [
            {
                parameterName: 'AuthorizeUrl',
                parameterType: 'AuthorizeUrl',
                parameterValue: 'https://scratch-org.example.invalid/services/oauth2/authorize'
            },
            {
                parameterName: 'TokenUrl',
                parameterType: 'TokenUrl',
                parameterValue: 'https://scratch-org.example.invalid/services/oauth2/token'
            }
        ]
    })
};

function makePackage(directory) {
    mkdirSync(directory, { recursive: true });
    const manifestPath = path.join(repoRoot, scratchOrg.externalClientAppManifest);
    const manifest = parser.parse(readFileSync(manifestPath, 'utf8'));
    copyFileSync(manifestPath, path.join(directory, 'package.xml'));
    for (const type of manifest.Package.types) {
        const [folder, suffix] = metadataTypes[type.name];
        mkdirSync(path.join(directory, folder), { recursive: true });
        for (const member of [type.members].flat()) {
            const file = `${folder}/${member}.${suffix}`;
            const fixture = ecaFixtureTypes[type.name];
            const destination = path.join(directory, file);
            if (fixture) {
                writeFileSync(
                    destination,
                    builder.build({
                        [type.name]: { '@_xmlns': 'http://soap.sforce.com/2006/04/metadata', ...fixture(member) }
                    })
                );
            } else {
                copyFileSync(path.join(repoRoot, 'force-app/main/default', file + '-meta.xml'), destination);
            }
        }
    }
}

function scratchQuery(args) {
    if (args[0] === 'data') {
        assert.match(args[args.indexOf('--query') + 1], /Profile.Name = 'System Administrator'/);
        return {
            status: 0,
            stdout: JSON.stringify({ status: 0, result: { records: [{ Username: 'scratch@example.invalid' }] } })
        };
    }
    return {
        status: 0,
        stdout: JSON.stringify({
            status: 0,
            result: {
                nonScratchOrgs: [],
                sandboxes: [],
                scratchOrgs: [
                    {
                        alias: 'test-scratch',
                        username: 'scratch@example.invalid',
                        instanceUrl: 'https://test-scratch.scratch.my.salesforce.com'
                    }
                ]
            }
        })
    };
}

for (const failedPhase of [undefined, 'convert', 'base', 'retrieve', 'policies', 'credentials']) {
    test(`ECA作成・ポリシー更新・資格情報登録の順序と一時ファイル削除: ${failedPhase ?? '成功'}`, () => {
        let temporaryRoot;
        const operations = [];
        const status = main({
            argv: ['--alias', 'test-scratch'],
            runSfQuery: scratchQuery,
            runSfCommand(args) {
                const conversion = args[1] === 'convert';
                const retrieval = args[1] === 'retrieve';
                const directory =
                    args[
                        args.indexOf(
                            conversion ? '--output-dir' : retrieval ? '--target-metadata-dir' : '--metadata-dir'
                        ) + 1
                    ];
                const phase = conversion ? 'convert' : retrieval ? 'retrieve' : path.basename(directory);
                operations.push(phase);
                temporaryRoot ??= path.dirname(directory);
                if (phase === failedPhase) return 7;
                if (conversion) {
                    makePackage(directory);
                } else if (retrieval) {
                    const folder = path.join(directory, 'unpackaged/extlClntAppOauthPolicies');
                    mkdirSync(folder, { recursive: true });
                    const policies = path.join(temporaryRoot, 'policies/extlClntAppOauthPolicies');
                    for (const file of require('node:fs').readdirSync(policies)) {
                        copyFileSync(
                            path.join(policies, file),
                            path.join(folder, file.replace('.ecaOauthPlcy', '_Generated.ecaOauthPlcy'))
                        );
                    }
                } else {
                    assert.equal(args[args.indexOf('--target-org') + 1], 'scratch@example.invalid');
                    const types = [
                        parser.parse(readFileSync(path.join(directory, 'package.xml'), 'utf8')).Package.types
                    ].flat();
                    assert.equal(
                        types.some((type) => type.name === 'ExtlClntAppOauthConfigurablePolicies'),
                        phase === 'policies'
                    );
                    if (phase === 'policies') {
                        assert.ok([types[0].members].flat().every((name) => name.endsWith('_Generated')));
                    }
                }
                return 0;
            },
            registerCredentials(username, mapping) {
                operations.push('credentials');
                assert.equal(username, 'scratch@example.invalid');
                assert.deepEqual(mapping, scratchOrg.externalClientAppProviders);
                if (failedPhase === 'credentials') throw new Error('登録失敗');
            }
        });
        const phases = ['convert', 'base', 'retrieve', 'policies', 'credentials'];
        assert.deepEqual(operations, failedPhase ? phases.slice(0, phases.indexOf(failedPhase) + 1) : phases);
        assert.equal(status, failedPhase === 'credentials' ? 1 : failedPhase ? 7 : 0);
        assert.equal(existsSync(temporaryRoot), false);
    });
}

test('Scratch Orgでない対象には変換・反映・資格情報登録を実行しない', () => {
    let commands = 0;
    const status = main({
        argv: ['--alias', 'dev-org'],
        runSfQuery: () => ({
            status: 0,
            stdout: JSON.stringify({
                status: 0,
                result: {
                    nonScratchOrgs: [
                        {
                            alias: 'dev-org',
                            username: 'dev@example.invalid',
                            instanceUrl: 'https://dev.my.salesforce.com',
                            orgId: '00D000000000001',
                            isSandbox: false,
                            orgEdition: 'Developer Edition'
                        }
                    ],
                    scratchOrgs: [],
                    sandboxes: []
                }
            })
        }),
        runSfCommand: () => ++commands,
        registerCredentials: () => ++commands
    });
    assert.equal(status, 1);
    assert.equal(commands, 0);
});

function withPackage(fn) {
    const directory = mkdtempSync(path.join(tmpdir(), 'eca-package-test-'));
    try {
        const base = path.join(directory, 'base');
        makePackage(base);
        fn(base);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

const target = {
    username: 'scratch&admin@example.invalid',
    instanceUrl: 'https://test-scratch.scratch.my.salesforce.com',
    providerApps: scratchOrg.externalClientAppProviders
};

function mutateXml(base, file, mutate) {
    const filepath = path.join(base, file);
    const document = parser.parse(readFileSync(filepath, 'utf8'));
    mutate(document);
    writeFileSync(filepath, builder.build(document));
}

test('全Client Credentials Flowを管理者へ置換し、ファイル名やアプリ名を固定しない', () =>
    withPackage((base) => {
        const { policyDirectory } = prepareEcaPackage(base, target);
        for (const name of ['HerokuPlaygroundIntegration', 'SampleIntegration']) {
            const policy = parser.parse(
                readFileSync(path.join(policyDirectory, `extlClntAppOauthPolicies/${name}.ecaOauthPlcy`), 'utf8')
            ).ExtlClntAppOauthConfigurablePolicies;
            assert.equal(policy.clientCredentialsFlowUser, target.username);
            assert.equal(policy.isClientCredentialsFlowEnabled, 'true');
        }
        const provider = readFileSync(
            path.join(base, 'externalAuthIdentityProviders/InternalSalesforceApi.externalAuthIdentityProvider'),
            'utf8'
        );
        assert.ok(provider.includes(`${target.instanceUrl}/services/oauth2/authorize`));
        assert.equal(provider.includes('scratch-org.example.invalid'), false);
    }));

test('対応設定の不足、外部接続先、Flow設定の不一致を反映前に拒否する', () => {
    withPackage((base) =>
        assert.throws(() => prepareEcaPackage(base, { ...target, providerApps: {} }), /全認証プロバイダー/)
    );
    withPackage((base) => {
        mutateXml(
            base,
            'externalAuthIdentityProviders/InternalSalesforceApi.externalAuthIdentityProvider',
            (document) => {
                document.ExternalAuthIdentityProvider.externalAuthIdentityProviderParameters[0].parameterValue =
                    'https://other.example.invalid/authorize';
            }
        );
        assert.throws(() => prepareEcaPackage(base, target), /同じScratch Org/);
    });
    withPackage((base) => {
        mutateXml(base, 'extlClntAppGlobalOauthSets/SampleIntegrationPerUser.ecaGlblOauth', (document) => {
            document.ExtlClntAppGlobalOauthSettings.isClientCredentialsFlowEnabled = 'true';
        });
        assert.throws(() => prepareEcaPackage(base, target), /一致しません/);
    });
});

function credentialsQuery(args) {
    assert.equal(args[args.indexOf('--target-org') + 1], 'scratch@example.invalid');
    return {
        status: 0,
        stdout: JSON.stringify({
            status: 0,
            result: { done: true, records: [{ DeveloperName: 'DifferentAppName', Id: '0xI000000000001' }] }
        })
    };
}

test('異なる名前のプロバイダーと同一ECAの複数参照を登録し、新規と更新を区別する', () => {
    const requests = [];
    registerProviderCredentials(
        'scratch@example.invalid',
        { NewProvider: 'DifferentAppName', ExistingProvider: 'DifferentAppName' },
        credentialsQuery,
        (targetOrg, resource, method, body) => {
            requests.push({ resource, method, body });
            assert.equal(targetOrg, 'scratch@example.invalid');
            if (method !== 'GET') return {};
            if (resource.endsWith('?part=keyandsecret')) return { key: 'test-client-id', secret: 'test-client-secret' };
            if (resource.startsWith('/apps/')) return { consumers: [{ id: '888000000000001' }] };
            return { credentials: resource.endsWith('NewProvider') ? [] : [{ credentialName: 'clientId' }] };
        }
    );
    assert.deepEqual(
        requests.map(({ method }) => method),
        ['GET', 'GET', 'GET', 'GET', 'POST', 'PUT']
    );
    assert.deepEqual(
        requests.slice(-2).map(({ body }) => body),
        Array(2).fill({
            credentials: [
                { credentialName: 'clientId', credentialValue: 'test-client-id' },
                { credentialName: 'clientSecret', credentialValue: 'test-client-secret' }
            ]
        })
    );
});

test('資格情報やプロバイダー状態を確認できなければ一件も書き込まない', () => {
    let writes = 0;
    assert.throws(
        () =>
            registerProviderCredentials(
                'scratch@example.invalid',
                { Provider: 'DifferentAppName' },
                credentialsQuery,
                (_, resource, method) => {
                    if (method !== 'GET') writes++;
                    if (resource.endsWith('?part=keyandsecret')) return { key: 'test-key' };
                    return { consumers: [{ id: '888000000000001' }] };
                }
            ),
        /OAuth資格情報/
    );
    assert.equal(writes, 0);
    assert.throws(
        () =>
            registerProviderCredentials('scratch@example.invalid', { Provider: "Invalid'Name" }, () =>
                assert.fail('queryを送信しない')
            ),
        /API名/
    );
});

test('REST要求の資格情報を引数・ファイルへ出さず、HTTP失敗の内容を伏せる', () => {
    const body = { credentials: [{ credentialName: 'clientSecret', credentialValue: 'sensitive-test-value' }] };
    assert.throws(
        () =>
            requestScratchRest(
                'scratch@example.invalid',
                '/named-credentials/test',
                'PUT',
                body,
                (_, args, options) => {
                    assert.equal(args.includes('sensitive-test-value'), false);
                    assert.equal(options.input, JSON.stringify(body));
                    assert.equal(options.env.SF_DISABLE_LOG_FILE, 'true');
                    assert.equal(args[args.indexOf('--body') + 1], '-');
                    return {
                        status: 1,
                        stdout: JSON.stringify({ status: 0, result: { statusCode: 400, body: 'sensitive-test-value' } })
                    };
                }
            ),
        (error) => error.message === 'Scratch OrgのOAuth資格情報APIが失敗しました。'
    );
});

test('ECAのOAuth定義と外部認証IDプロバイダーをGit管理から除外し、manifest範囲を照合する', () => {
    const { execFileSync } = require('node:child_process');
    const files = execFileSync('git', ['ls-files', '-z', '--', 'force-app/main/default'], {
        cwd: repoRoot,
        encoding: 'utf8'
    }).split('\0');
    const types = parser.parse(readFileSync(path.join(repoRoot, scratchOrg.externalClientAppManifest), 'utf8')).Package
        .types;
    for (const [name, [folder, suffix]] of Object.entries(metadataTypes)) {
        if (name === 'PermissionSet') continue;
        const prefix = `force-app/main/default/${folder}/`;
        const sourceNames = files
            .filter((file) => file.startsWith(prefix) && file.endsWith(`.${suffix}-meta.xml`))
            .map((file) => file.slice(prefix.length, -`.${suffix}-meta.xml`.length))
            .sort();
        const members = types
            .filter((type) => type.name === name)
            .flatMap((type) => [type.members].flat())
            .sort();
        if (ecaFixtureTypes[name]) {
            assert.deepEqual(sourceNames, [], name);
            assert.ok(members.length > 0, name);
            for (const member of members) {
                execFileSync('git', ['check-ignore', '-q', '--', `${prefix}${member}.${suffix}-meta.xml`], {
                    cwd: repoRoot
                });
            }
        } else {
            assert.deepEqual(members, sourceNames, name);
        }
        assert.equal(members.includes('*'), false);
    }
});

test('資格情報更新用のアプリに利用権限を追加しない', () =>
    withPackage((base) => {
        const { policyDirectory } = prepareEcaPackage(base, target);
        const policy = parser.parse(
            readFileSync(
                path.join(policyDirectory, 'extlClntAppOauthPolicies/SampleIntegrationPerUser.ecaOauthPlcy'),
                'utf8'
            )
        ).ExtlClntAppOauthConfigurablePolicies;
        assert.equal(policy.commaSeparatedProfile, undefined);
        assert.equal(policy.commaSeparatedPermissionSet, undefined);
        assert.equal(policy.refreshTokenPolicyType, 'Zero');
        assert.equal(policy.requiredSessionLevel, 'HIGH_ASSURANCE');
    }));

test('プリンシパルの追加・削除を一時権限セットに反映する', () =>
    withPackage((base) => {
        mutateXml(base, 'externalCredentials/InternalSalesforceApi.externalCredential', (document) => {
            const parameters = document.ExternalCredential.externalCredentialParameters;
            document.ExternalCredential.externalCredentialParameters = parameters.filter(
                (p) => p.parameterType !== 'PerUserPrincipal'
            );
            document.ExternalCredential.externalCredentialParameters.push({
                parameterName: 'AdditionalPrincipal',
                parameterGroup: 'AdditionalPrincipal',
                parameterType: 'NamedPrincipal',
                sequenceNumber: '1'
            });
        });
        prepareEcaPackage(base, target);
        const permission = parser.parse(
            readFileSync(path.join(base, 'permissionsets/ScratchOrgExternalCredentialAccess.permissionset'), 'utf8')
        ).PermissionSet;
        const accesses = permission.externalCredentialPrincipalAccesses.map(
            (value) => value.externalCredentialPrincipal
        );
        assert.ok(accesses.includes('InternalSalesforceApi-AdditionalPrincipal'));
        assert.equal(accesses.includes('InternalSalesforceApi-SalesforceApiUserPrincipal'), false);
    }));
