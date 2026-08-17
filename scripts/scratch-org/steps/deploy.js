// 実行コマンド: node scripts/scratch-org/steps/deploy.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch Orgへ初期メタデータを反映する。

const { runCommand } = require('../../internal/run-command');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

const usage = '実行コマンド: node scripts/scratch-org/steps/deploy.js [--alias <alias>]';

process.exitCode = runAliasCommand({
    argv: process.argv.slice(2),
    defaultAlias: scratchOrg.alias,
    usage,
    execute(alias) {
        // Scratch Org再現用に限定したmanifestを、作成済みのaliasへ反映する。
        return runCommand(
            'sf',
            [
                'project',
                'deploy',
                'start',
                '--manifest',
                scratchOrg.manifest,
                '--target-org',
                alias,
                '--wait',
                String(scratchOrg.waitMinutes)
            ],
            repoRoot
        );
    }
});
