const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { main } = require('../steps/deploy-external-client-apps');

test('定義したローカルECAとOAuth設定だけを検証済みScratch Orgに送る', () => {
    const app = { apiName: 'TestIntegration', label: 'Test & Integration', scopes: ['Api', 'OpenID'] };
    const rotationApp = { apiName: 'RotationTest', label: 'Rotation test', scopes: ['Api'], rotationOnly: true };
    let directory;
    const status = main({
        argv: ['--alias', 'test-scratch'],
        apps: [app, rotationApp],
        runSfQuery() {
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
                                instanceUrl: 'https://scratch.example.invalid'
                            }
                        ]
                    }
                })
            };
        },
        runSfCommand(args) {
            directory = args[args.indexOf('--metadata-dir') + 1];
            assert.equal(args[args.indexOf('--target-org') + 1], 'scratch@example.invalid');
            const manifest = readFileSync(join(directory, 'package.xml'), 'utf8');
            assert.equal([...manifest.matchAll(/<members>TestIntegration<\/members>/g)].length, 3);
            const header = readFileSync(join(directory, 'externalClientApps', 'TestIntegration.eca'), 'utf8');
            assert.match(header, /<distributionState>Local<\/distributionState>/);
            assert.match(header, /Test &amp; Integration/);
            assert.doesNotMatch(header, /orgScopedExternalApp/);
            const oauth = readFileSync(join(directory, 'extlClntAppOauthSettings', 'TestIntegration.ecaOauth'), 'utf8');
            assert.match(oauth, /<commaSeparatedOauthScopes>Api, OpenID<\/commaSeparatedOauthScopes>/);
            assert.doesNotMatch(oauth, /oauthLink/);
            const policyDir = join(directory, 'extlClntAppOauthPolicies');
            const policy = readFileSync(join(policyDir, 'RotationTest.ecaOauthPlcy'), 'utf8');
            assert.match(policy, /<permittedUsersPolicyType>AdminApprovedPreAuthorized<\/permittedUsersPolicyType>/);
            assert.doesNotMatch(policy, /commaSeparated(?:PermissionSet|Profile)/);
            assert.equal(existsSync(join(policyDir, 'TestIntegration.ecaOauthPlcy')), false);
            return 7;
        }
    });
    assert.equal(status, 7);
    assert.equal(existsSync(directory), false);
});

test('アプリの定義が空ならSalesforce CLIを起動しない', () => {
    const unexpectedCall = () => assert.fail('Salesforce CLIを呼び出しました。');
    assert.equal(main({ argv: [], apps: [], runSfQuery: unexpectedCall, runSfCommand: unexpectedCall }), 0);
});
