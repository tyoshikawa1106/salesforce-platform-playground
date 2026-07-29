#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    buildSfArgs,
    defaultPlan,
    extractSfSummary,
    parseArgs,
    prepareEntries,
    readPlan
} = require('./import-test-data-core');

const repoRoot = path.resolve(__dirname, '../..');

function printHelp() {
    process.stdout.write(`Usage:
  npm run setup:data:standard:dry-run
  npm run setup:data:standard -- --target-org <alias>

Options:
  --plan <path>           Import plan JSON. Default: ${defaultPlan}
  --only <label>          Run a single plan entry.
  --default-repeat <n>    Repeat entries that do not define their own repeat.
  --repeat <n>            Force the same repeat count for selected entries.
  --target-org, -o        Salesforce org alias for real import.
  --dry-run               Validate local files and print the sf commands.
`);
}

function writeLine(message = '') {
    process.stdout.write(`${message}\n`);
}

function printStep({ cycle, dryRun, entry, repeatCount, sfArgs, sourcePaths }) {
    const cycleSuffix = repeatCount > 1 ? ` (${cycle}/${repeatCount})` : '';

    writeLine(`[${dryRun ? 'dry-run' : 'import'}] ${entry.label}${cycleSuffix}`);
    writeLine(`sources: ${sourcePaths.join(' + ')}`);
    writeLine(`sf ${sfArgs.join(' ')}`);
}

function runSfCommand(entry, sfArgs) {
    const result = spawnSync('sf', sfArgs, {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    if (result.status !== 0) {
        process.stdout.write(result.stdout || '');
        process.stderr.write(result.stderr || '');
        throw new Error(`sf command failed for ${entry.label}`);
    }

    for (const line of extractSfSummary(`${result.stdout || ''}\n${result.stderr || ''}`)) {
        writeLine(line);
    }
}

function getGeneratedFileName(label) {
    return `${label.replace(/[^a-z0-9-]/gi, '-')}.apex`;
}

function run() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printHelp();
        return;
    }

    if (!args.dryRun && !args.targetOrg) {
        throw new Error('Real import requires --target-org <alias>. Use --dry-run to validate locally.');
    }

    const plan = readPlan({
        fileSystem: fs,
        planPath: args.plan,
        repoRoot
    });
    const preparedEntries = prepareEntries({
        args,
        fileSystem: fs,
        plan,
        repoRoot
    });
    const targetOrg = args.targetOrg || '<target-org>';
    let temporaryDirectory = null;

    try {
        for (const prepared of preparedEntries) {
            const generatedFileName = getGeneratedFileName(prepared.entry.label);
            const generatedFilePath = args.dryRun
                ? `<generated:${generatedFileName}>`
                : path.join(
                      (temporaryDirectory ??= fs.mkdtempSync(path.join(os.tmpdir(), 'salesforce-seed-'))),
                      generatedFileName
                  );

            if (!args.dryRun) {
                fs.writeFileSync(generatedFilePath, prepared.source, 'utf8');
            }

            const sfArgs = buildSfArgs(generatedFilePath, targetOrg);

            for (let cycle = 1; cycle <= prepared.repeatCount; cycle += 1) {
                printStep({
                    cycle,
                    dryRun: args.dryRun,
                    entry: prepared.entry,
                    repeatCount: prepared.repeatCount,
                    sfArgs,
                    sourcePaths: prepared.sourcePaths
                });

                if (!args.dryRun) {
                    runSfCommand(prepared.entry, sfArgs);
                }
            }
        }
    } finally {
        if (temporaryDirectory) {
            fs.rmSync(temporaryDirectory, { force: true, recursive: true });
        }
    }
}

try {
    run();
} catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
}
