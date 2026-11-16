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
                                instanceUrl: 'https://scratch.example.invalid'
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
            return 7;
        }
    });
    assert.equal(status, 7);
    assert.equal(existsSync(packageDir), false);
});
