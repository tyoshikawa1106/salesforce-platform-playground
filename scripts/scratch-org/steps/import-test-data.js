// 実行コマンド: node scripts/scratch-org/steps/import-test-data.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch Orgへ標準テストデータを投入する。

const { run: runImportTestData } = require('../../setup/import-test-data');
const { scratchOrg } = require('../internal/context');
const { parseAlias } = require('../internal/command');

// helpと引数エラーで同じ実行例を表示する。
const usage = '実行コマンド: node scripts/scratch-org/steps/import-test-data.js [--alias <alias>]';

// 共通のデータ投入スクリプトをScratch Org用の設定で実行する。
async function main({
    argv = process.argv.slice(2),
    runImportTestDataCommand = runImportTestData,
    stderr = process.stderr,
    stdout = process.stdout
} = {}) {
    // help要求ではalias解析やデータ投入を行わない。
    if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
        stdout.write(`${usage}\n`);
        return 0;
    }

    try {
        // 未指定時は再現設定のaliasを使い、指定時は検証済みaliasへ限定する。
        const alias = parseAlias(argv, scratchOrg.alias, false);

        // 利用者向けのTarget Org指定とは分離し、作成済みScratch Orgだけを内部的に引き渡す。
        await runImportTestDataCommand({
            argv: ['--plan', scratchOrg.importPlan, '--default-repeat', '40'],
            targetOrg: alias
        });
        // 共通データ投入が完了した場合だけ成功を返す。
        return 0;
    } catch (error) {
        // setup.jsが失敗stepを識別できるよう、利用者向け表示後に1を返す。
        stderr.write(`エラー: ${error.message}\n`);
        stderr.write(`${usage}\n`);
        return 1;
    }
}

// コマンドとして実行された場合だけテストデータを投入する。
if (require.main === module) {
    // 非同期処理の終了コードを親のsetup.jsまたはshellへ反映する。
    main().then((exitCode) => {
        process.exitCode = exitCode;
    });
}

// alias引数と共通データ投入の連携を組織接続なしでテストできるようmainを公開する。
module.exports = { main };
