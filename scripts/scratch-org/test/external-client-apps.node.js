const test = require('node:test');
const assert = require('node:assert/strict');
const { main } = require('../steps/deploy-external-client-apps');
const { scratchOrg } = require('../internal/context');

test('ECA専用manifestを確認済みScratch Orgへ送る', () => {
    const status = main({
        argv: ['--alias', 'test-scratch'],
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
            assert.equal(args[args.indexOf('--target-org') + 1], 'scratch@example.invalid');
            assert.equal(args[args.indexOf('--manifest') + 1], scratchOrg.externalClientAppManifest);
            return 7;
        }
    });
    assert.equal(status, 7);
});
