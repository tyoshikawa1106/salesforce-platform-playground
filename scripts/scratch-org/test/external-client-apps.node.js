const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, mkdirSync, readFileSync, copyFileSync } = require('node:fs');
const path = require('node:path');
const { main } = require('../steps/deploy-external-client-apps');
const { scratchOrg } = require('../internal/context');

test('ECA専用manifestを確認済みScratch Orgへ送る', () => {
    let packageDir;
    const status = main({
        argv: ['--alias', 'test-scratch'],
        runSfQuery(args) {
            if (args[0] === 'data') {
                assert.match(args[args.indexOf('--query') + 1], /Profile.Name = 'System Administrator'/);
                return {
                    status: 0,
                    stdout: JSON.stringify({
                        status: 0,
                        result: { records: [{ Username: 'scratch@example.invalid' }] }
                    })
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
        },
        runSfCommand(args, cwd) {
            if (args[1] === 'convert') {
                assert.equal(args[args.indexOf('--manifest') + 1], scratchOrg.externalClientAppManifest);
                packageDir = args[args.indexOf('--output-dir') + 1];
                for (const [folder, suffix] of [
                    ['externalAuthIdentityProviders', 'externalAuthIdentityProvider'],
                    ['namedCredentials', 'namedCredential'],
                    ['extlClntAppGlobalOauthSets', 'ecaGlblOauth']
                ]) {
                    mkdirSync(path.join(packageDir, folder));
                    for (const name of [
                        'ExternalClientAppManager',
                        'InternalSalesforceApi',
                        'SalesforceApiIntegration'
                    ]) {
                        const file = path.join(folder, `${name}.${suffix}`);
                        copyFileSync(
                            path.join(cwd, 'force-app/main/default', file + '-meta.xml'),
                            path.join(packageDir, file)
                        );
                    }
                }
                const relativePath = 'extlClntAppOauthPolicies/HerokuPlaygroundIntegration.ecaOauthPlcy';
                mkdirSync(path.join(packageDir, path.dirname(relativePath)));
                copyFileSync(
                    path.join(cwd, 'force-app/main/default', relativePath + '-meta.xml'),
                    path.join(packageDir, relativePath)
                );
                return 0;
            }
            assert.equal(args[args.indexOf('--target-org') + 1], 'scratch@example.invalid');
            const policy = readFileSync(
                path.join(packageDir, 'extlClntAppOauthPolicies/HerokuPlaygroundIntegration.ecaOauthPlcy'),
                'utf8'
            );
            assert.match(policy, /<clientCredentialsFlowUser>scratch@example.invalid<\/clientCredentialsFlowUser>/);
            assert.match(policy, /<isClientCredentialsFlowEnabled>true<\/isClientCredentialsFlowEnabled>/);
            const provider = readFileSync(
                path.join(
                    packageDir,
                    'externalAuthIdentityProviders/InternalSalesforceApi.externalAuthIdentityProvider'
                ),
                'utf8'
            );
            assert.ok(provider.includes('https://test-scratch.scratch.my.salesforce.com/services/oauth2/authorize'));
            const oauth = readFileSync(
                path.join(packageDir, 'extlClntAppGlobalOauthSets/InternalSalesforceApi.ecaGlblOauth'),
                'utf8'
            );
            assert.ok(oauth.includes('https://test-scratch.scratch.my.salesforce.com/services/extidp/callback'));
            return 7;
        }
    });
    assert.equal(status, 7);
    assert.equal(existsSync(packageDir), false);
});

test('反映後に同じ組織のECAの現行資格情報を対応するプロバイダーに登録する', () => {
    const { registerProviderCredentials } = require('../internal/eca-provider-credentials');
    const username = 'scratch@example.invalid';
    const providerNames = ['TestProviderOne', 'TestProviderTwo'];
    const records = providerNames.map((DeveloperName, index) => ({
        DeveloperName,
        Id: `0xI00000000000${index}`
    }));
    const requests = [];
    registerProviderCredentials(
        username,
        providerNames,
        (args) => {
            assert.equal(args[args.indexOf('--target-org') + 1], username);
            return { status: 0, stdout: JSON.stringify({ status: 0, result: { records } }) };
        },
        (target, url, method, body) => {
            assert.equal(target, username);
            requests.push({ url, method, body });
            if (method === 'PUT') return;
            if (url.endsWith('?part=keyandsecret')) return { key: 'test-client-id', secret: 'test-client-secret' };
            return { consumers: [{ id: '888000000000000' }] };
        }
    );
    assert.deepEqual(
        requests.map(({ method }) => method),
        ['GET', 'GET', 'GET', 'GET', 'PUT', 'PUT']
    );
    assert.deepEqual(
        requests.slice(4).map(({ url }) => url),
        providerNames.map((name) => `/named-credentials/external-auth-identity-provider-credentials/${name}`)
    );
    assert.deepEqual(requests[4].body.credentials, [
        { credentialName: 'clientId', credentialValue: 'test-client-id' },
        { credentialName: 'clientSecret', credentialValue: 'test-client-secret' }
    ]);
});
