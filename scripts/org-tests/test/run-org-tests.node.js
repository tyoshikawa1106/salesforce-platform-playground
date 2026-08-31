// 実行コマンド: node --test scripts/org-tests/test/run-org-tests.node.js
// 用途: ApexとFlowの組織テスト入口に共通する接続先確認と実行scopeを検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { main: runApexTests } = require('../run-apex-tests');
const { main: runFlowTests } = require('../run-flow-tests');
const { sfCommandTimeoutMs } = require('../internal/test-runner');
const { createOrgInfoCommand, createPrompt, createSfResult } = require('./test-helper');

// 組織テスト実行スクリプトをリポジトリルート基準で実行する。
const repoRoot = path.resolve(__dirname, '../../..');

const orgTestCommands = [
    {
        label: 'Apex',
        main: runApexTests,
        scriptPath: 'scripts/org-tests/run-apex-tests.js',
        testType: 'apex',
        usage: 'npm run sf:test:apex'
    },
    {
        label: 'Flow',
        main: runFlowTests,
        scriptPath: 'scripts/org-tests/run-flow-tests.js',
        testType: 'flow',
        usage: 'npm run sf:test:flow'
    }
];

for (const { label, main, scriptPath, testType, usage } of orgTestCommands) {
    test(`${label} test scriptはDefault Target Org以外を示す引数をSalesforce CLI実行前に拒否する`, () => {
        const result = spawnSync(process.execPath, [scriptPath, '--unknown'], {
            cwd: repoRoot,
            encoding: 'utf8'
        });

        assert.equal(result.status, 1);
        assert.match(result.stderr, /対象組織はDefault Target Orgから取得するため、引数は指定できません。/);
        assert.match(result.stderr, new RegExp(`実行コマンド: ${usage}`));
    });

    test(`${label} test scriptはDefault Target Orgを確認できない場合に入力確認を開始しない`, async () => {
        let promptCount = 0;

        await assert.rejects(
            () =>
                main({
                    argv: [],
                    createPrompt() {
                        promptCount += 1;
                    },
                    runSfWithOutputCommand() {
                        return createSfResult([{ name: 'target-org', success: true }]);
                    }
                }),
            /Default Target Orgが設定されていません/
        );

        assert.equal(promptCount, 0);
    });

    test(`${label} test scriptは接続組織が承認されない場合にテストを実行しない`, async () => {
        const testRuns = [];
        const prompt = createPrompt(['n']);
        const status = await main({
            argv: [],
            createPrompt: () => prompt.prompt,
            runTestCommand(options) {
                testRuns.push(options);
                return 0;
            },
            runSfWithOutputCommand: createOrgInfoCommand()
        });

        assert.equal(status, 0);
        assert.deepEqual(testRuns, []);
        assert.deepEqual(prompt.getQuestions(), [`この接続組織で${label}テストを実行しますか？ [y/N]: `]);
        assert.equal(prompt.isClosed(), true);
    });

    test(`${label} test scriptは接続組織が承認された場合だけ非同期テストを開始する`, async () => {
        const testRuns = [];
        const orgInfoTimeouts = [];
        const prompt = createPrompt(['y']);
        const orgInfoCommand = createOrgInfoCommand();
        const status = await main({
            argv: [],
            createPrompt: () => prompt.prompt,
            runTestCommand(options) {
                testRuns.push({ targetOrg: options.targetOrg, testType: options.testType });
                return 0;
            },
            runSfWithOutputCommand(args, cwd, spawnCommand, maxBuffer, timeout) {
                orgInfoTimeouts.push(timeout);
                return orgInfoCommand(args);
            }
        });

        assert.equal(status, 0);
        assert.deepEqual(testRuns, [{ targetOrg: 'test-org', testType }]);
        assert.deepEqual(orgInfoTimeouts, Array(testType === 'apex' ? 3 : 2).fill(sfCommandTimeoutMs));
        assert.equal(prompt.isClosed(), true);
    });

    test(`${label} test scriptはテスト実行が失敗した場合に終了コードを返す`, async () => {
        const prompt = createPrompt(['y']);
        const status = await main({
            argv: [],
            createPrompt: () => prompt.prompt,
            runTestCommand() {
                return 1;
            },
            runSfWithOutputCommand: createOrgInfoCommand()
        });

        assert.equal(status, 1);
        assert.equal(prompt.isClosed(), true);
    });

    test(`${label} test scriptは本番環境の追加確認が承認されない場合にテストを実行しない`, async () => {
        const testRuns = [];
        const prompt = createPrompt(['y', 'n']);
        const status = await main({
            argv: [],
            createPrompt: () => prompt.prompt,
            runTestCommand(options) {
                testRuns.push(options);
                return 0;
            },
            runSfWithOutputCommand: createOrgInfoCommand('production')
        });

        assert.equal(status, 0);
        assert.deepEqual(testRuns, []);
        assert.deepEqual(prompt.getQuestions(), [
            `この接続組織で${label}テストを実行しますか？ [y/N]: `,
            `本番環境です。${label}テストを実行してよろしいですか？ [y/N]: `
        ]);
        assert.equal(prompt.isClosed(), true);
    });

    test(`${label} test scriptは本番環境の全確認が承認された場合だけテストを開始する`, async () => {
        const testRuns = [];
        const prompt = createPrompt(['y', 'Y']);
        const status = await main({
            argv: [],
            createPrompt: () => prompt.prompt,
            runTestCommand(options) {
                testRuns.push({ targetOrg: options.targetOrg, testType: options.testType });
                return 0;
            },
            runSfWithOutputCommand: createOrgInfoCommand('production')
        });

        assert.equal(status, 0);
        assert.deepEqual(testRuns, [{ targetOrg: 'test-org', testType }]);
        assert.equal(prompt.isClosed(), true);
    });
}

test('Apexの並列実行オプションが有効な場合は承認前に注意を表示する', async () => {
    const lines = [];
    const prompt = createPrompt(['n']);
    const orgInfoCommand = createOrgInfoCommand();

    const status = await runApexTests({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfWithOutputCommand(args) {
            if (args[0] === 'data') {
                return createSfResult({ records: [{ IsDisableParallelApexTestingEnabled: false }] });
            }

            return orgInfoCommand(args);
        },
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 0);
    assert.deepEqual(lines, ['注意: 対象組織ではApexテストの並列実行オプションが有効です。']);
    assert.deepEqual(prompt.getQuestions(), ['この接続組織でApexテストを実行しますか？ [y/N]: ']);
});

test('Apexの並列実行が無効な場合は並列実行オプションの注意を表示しない', async () => {
    const lines = [];
    const prompt = createPrompt(['n']);
    const orgInfoCommand = createOrgInfoCommand();

    const status = await runApexTests({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfWithOutputCommand(args) {
            if (args[0] === 'data') {
                return createSfResult({ records: [{ IsDisableParallelApexTestingEnabled: true }] });
            }

            return orgInfoCommand(args);
        },
        writeLine(message) {
            lines.push(message);
        }
    });

    assert.equal(status, 0);
    assert.deepEqual(lines, []);
    assert.deepEqual(prompt.getQuestions(), ['この接続組織でApexテストを実行しますか？ [y/N]: ']);
});

test('Apexの並列実行設定を確認できない場合も注意を表示して実行へ進める', async () => {
    const errors = [];
    const testRuns = [];
    const prompt = createPrompt(['y']);
    const orgInfoCommand = createOrgInfoCommand();

    const status = await runApexTests({
        argv: [],
        createPrompt: () => prompt.prompt,
        runSfWithOutputCommand(args) {
            if (args[0] === 'data') {
                return { status: 0, stderr: '', stdout: 'not-json' };
            }

            return orgInfoCommand(args);
        },
        runTestCommand(options) {
            testRuns.push(options.testType);
            return 0;
        },
        writeError(message) {
            errors.push(message);
        }
    });

    assert.equal(status, 0);
    assert.deepEqual(testRuns, ['apex']);
    assert.match(errors[0], /並列実行設定を確認できませんでした。テストは続行できます/);
});
