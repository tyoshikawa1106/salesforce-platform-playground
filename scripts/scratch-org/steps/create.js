// 実行コマンド: node scripts/scratch-org/steps/create.js [--alias <alias>]
// 用途: setup.jsから呼び出し、設定ファイルに従ってScratch Orgを作成する。

const { runCommand } = require('../../internal/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

const usage = '実行コマンド: node scripts/scratch-org/steps/create.js [--alias <alias>]';

process.exitCode = runAliasCommand({
    argv: process.argv.slice(2),
    defaultAlias: scratchOrg.alias,
    usage,
    execute(alias) {
        // 実行対象をログに残し、後続ステップと同じaliasであることを確認できるようにする。
        process.stdout.write(`使用するScratch Org alias: ${alias}\n`);

        // 設定ファイルのdefinition、alias、有効日数を使用してScratch Orgを作成する。
        return runCommand(
            'sf',
            [
                'org',
                'create',
                'scratch',
                '--definition-file',
                scratchOrg.definitionFile,
                '--alias',
                alias,
                '--duration-days',
                String(scratchOrg.durationDays)
            ],
            repoRoot
        );
    }
});
