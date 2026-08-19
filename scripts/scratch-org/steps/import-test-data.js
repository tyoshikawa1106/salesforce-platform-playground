// 実行コマンド: node scripts/scratch-org/steps/import-test-data.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch Orgへ標準テストデータを投入する。

const { run: runImportTestData } = require('../../setup/import-test-data');
const { scratchOrg } = require('../internal/context');
const { parseAlias } = require('../internal/command');

const usage = '実行コマンド: node scripts/scratch-org/steps/import-test-data.js [--alias <alias>]';

// 共通のデータ投入スクリプトをScratch Org用の設定で実行する。
async function main({
    argv = process.argv.slice(2),
    runImportTestDataCommand = runImportTestData,
    stderr = process.stderr,
    stdout = process.stdout
} = {}) {
    if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
        stdout.write(`${usage}\n`);
        return 0;
    }

    try {
        const alias = parseAlias(argv, scratchOrg.alias, false);

        // 利用者向けのTarget Org指定とは分離し、作成済みScratch Orgだけを内部的に引き渡す。
        await runImportTestDataCommand({
            argv: ['--plan', scratchOrg.importPlan, '--default-repeat', '40'],
            targetOrg: alias
        });
        return 0;
    } catch (error) {
        stderr.write(`エラー: ${error.message}\n`);
        stderr.write(`${usage}\n`);
        return 1;
    }
}

// コマンドとして実行された場合だけテストデータを投入する。
if (require.main === module) {
    main().then((exitCode) => {
        process.exitCode = exitCode;
    });
}

module.exports = { main };
