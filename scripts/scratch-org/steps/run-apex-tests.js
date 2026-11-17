// 実行コマンド: node scripts/scratch-org/steps/run-apex-tests.js [--alias <alias>]
// 用途: 権限セットを割り当てた後、対象Scratch OrgのローカルApexテストを実行する。

const { runSfWithOutput } = require('../../common/run-command');
const { getTargetOrgInfo, orgTypes } = require('../../common/target-org');
const { runAndMonitorTests } = require('../../org-tests/internal/test-runner');
const { parseAlias } = require('../internal/command');
const { repoRoot, scratchOrg } = require('../internal/context');

const usage = '実行コマンド: node scripts/scratch-org/steps/run-apex-tests.js [--alias <alias>]';

async function main({
    argv = process.argv.slice(2),
    runSfQuery = runSfWithOutput,
    runTests = runAndMonitorTests
} = {}) {
    if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) {
        console.log(usage);
        return 0;
    }

    try {
        const alias = parseAlias(argv, scratchOrg.alias, false);
        const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfQuery, targetOrg: alias });
        if (orgInfo.type !== orgTypes.SCRATCH) {
            throw new Error('再構築のApexテストはScratch Orgだけに実行できます。');
        }
        return await runTests({ testType: 'apex', targetOrg: orgInfo.username, repoRoot });
    } catch (error) {
        console.error(`エラー: ${error.message}`);
        return 1;
    }
}

if (require.main === module) {
    main().then((status) => {
        process.exitCode = status;
    });
}

module.exports = { main };
