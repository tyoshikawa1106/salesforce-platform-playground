#!/usr/bin/env node
const { runCommand } = require('../run-command');
const { repoRoot, scratchOrg } = require('./internal-context');
const { runNoArgumentCommand } = require('./internal-command');

// setup.jsから呼び出すScratch Org作成ステップ。
const usage = 'Usage: node scripts/scratch-org/internal-create.js';

process.exitCode = runNoArgumentCommand({
    argv: process.argv.slice(2),
    usage,
    execute() {
        // 実行対象をログに残し、後続ステップと同じaliasであることを確認できるようにする。
        process.stdout.write(`Using Scratch Org alias: ${scratchOrg.alias}\n`);

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
                scratchOrg.alias,
                '--duration-days',
                String(scratchOrg.durationDays)
            ],
            repoRoot
        );
    }
});
