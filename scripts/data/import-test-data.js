#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = process.cwd();

function parseArgs(argv) {
    const args = {
        dryRun: false,
        plan: 'data/test-data/import-plan.json',
        only: null,
        repeat: null,
        targetOrg: null
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--dry-run') {
            args.dryRun = true;
            continue;
        }

        if (arg === '--plan') {
            args.plan = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg === '--only') {
            args.only = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg === '--repeat') {
            args.repeat = Number(argv[index + 1]);
            index += 1;
            continue;
        }

        if (arg === '--target-org' || arg === '-o') {
            args.targetOrg = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return args;
}

function printHelp() {
    console.log(`Usage:
  npm run data:import:test:dry-run
  npm run data:import:test -- --target-org <alias>
  npm run data:seed:standard:dry-run
  npm run data:seed:standard -- --target-org <alias>

Options:
  --plan <path>        Import plan JSON. Default: data/test-data/import-plan.json
  --only <label>       Run a single plan entry.
  --repeat <count>     Repeat selected plan entries. Default: plan repeat or 1.
  --target-org, -o     Salesforce org alias for real import.
  --dry-run            Validate local files and print the sf commands.
`);
}

function resolveInsideRepo(relativePath) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    const relative = path.relative(repoRoot, absolutePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(
            `Path must stay inside the repository: ${relativePath}`
        );
    }

    return absolutePath;
}

function readPlan(planPath) {
    const absolutePlanPath = resolveInsideRepo(planPath);
    const raw = fs.readFileSync(absolutePlanPath, 'utf8');
    const plan = JSON.parse(raw);

    if (!Array.isArray(plan.imports) || plan.imports.length === 0) {
        throw new Error('Import plan must contain a non-empty imports array.');
    }

    return plan;
}

function validateEntry(entry) {
    const requiredKeys = ['label', 'operation', 'file'];
    const missingKeys = requiredKeys.filter((key) => !entry[key]);

    if (missingKeys.length > 0) {
        throw new Error(
            `Plan entry is missing required keys: ${missingKeys.join(', ')}`
        );
    }

    if (!['insert', 'upsert', 'apex'].includes(entry.operation)) {
        throw new Error(
            `Unsupported operation for ${entry.label}: ${entry.operation}`
        );
    }

    if (['insert', 'upsert'].includes(entry.operation) && !entry.sobject) {
        throw new Error(
            `Data import entry must include sobject: ${entry.label}`
        );
    }

    if (entry.operation === 'upsert' && !entry.externalId) {
        throw new Error(`Upsert entry must include externalId: ${entry.label}`);
    }

    const absoluteFilePath = resolveInsideRepo(entry.file);

    if (!fs.existsSync(absoluteFilePath)) {
        throw new Error(
            `CSV file does not exist for ${entry.label}: ${entry.file}`
        );
    }

    const fileContent = fs.readFileSync(absoluteFilePath, 'utf8');
    const firstLine = fileContent.split(/\r?\n/, 1)[0];

    if (
        ['insert', 'upsert'].includes(entry.operation) &&
        (!firstLine || firstLine.split(',').length < 2)
    ) {
        throw new Error(
            `CSV file must include a header with at least two columns: ${entry.file}`
        );
    }

    if (entry.operation === 'apex' && fileContent.trim().length === 0) {
        throw new Error(`Apex file must not be empty: ${entry.file}`);
    }

    return absoluteFilePath;
}

function buildSfArgs(entry, absoluteFilePath, targetOrg) {
    const wait = String(entry.wait ?? 30);

    if (entry.operation === 'apex') {
        return [
            'apex',
            'run',
            '--file',
            absoluteFilePath,
            '--target-org',
            targetOrg
        ];
    }

    if (entry.operation === 'upsert') {
        return [
            'data',
            'upsert',
            'bulk',
            '--file',
            absoluteFilePath,
            '--sobject',
            entry.sobject,
            '--external-id',
            entry.externalId,
            '--target-org',
            targetOrg,
            '--wait',
            wait
        ];
    }

    return [
        'data',
        'import',
        'bulk',
        '--file',
        absoluteFilePath,
        '--sobject',
        entry.sobject,
        '--target-org',
        targetOrg,
        '--wait',
        wait
    ];
}

function printSfSummary(output) {
    const summaryLines = output
        .split(/\r?\n/)
        .filter((line) =>
            /USER_DEBUG\|.*\|(DEBUG)\|(Seed run key|Created records|Skipped records):/.test(
                line
            )
        )
        .map((line) => line.replace(/^.*\|DEBUG\|/, ''));

    for (const line of summaryLines) {
        console.log(line);
    }
}

function run() {
    const args = parseArgs(process.argv.slice(2));
    const plan = readPlan(args.plan);
    const repeatCount = args.repeat ?? plan.repeat ?? 1;
    const selectedEntries = args.only
        ? plan.imports.filter((entry) => entry.label === args.only)
        : plan.imports;

    if (selectedEntries.length === 0) {
        throw new Error(`No import plan entries matched --only ${args.only}`);
    }

    if (!args.dryRun && !args.targetOrg) {
        throw new Error(
            'Real import requires --target-org <alias>. Use --dry-run to validate locally.'
        );
    }

    if (!Number.isInteger(repeatCount) || repeatCount < 1) {
        throw new Error('Repeat count must be a positive integer.');
    }

    for (let cycle = 1; cycle <= repeatCount; cycle += 1) {
        for (const entry of selectedEntries) {
            const entryRepeatCount = args.repeat ?? entry.repeat ?? repeatCount;

            if (cycle > entryRepeatCount) {
                continue;
            }

            const absoluteFilePath = validateEntry(entry);
            const targetOrg = args.targetOrg || '<target-org>';
            const sfArgs = buildSfArgs(entry, absoluteFilePath, targetOrg);
            const cycleSuffix =
                repeatCount > 1 ? ` (${cycle}/${repeatCount})` : '';

            console.log(
                `[${args.dryRun ? 'dry-run' : 'import'}] ${entry.label}${cycleSuffix}`
            );
            console.log(`sf ${sfArgs.join(' ')}`);

            if (args.dryRun) {
                continue;
            }

            const result = spawnSync('sf', sfArgs, {
                cwd: repoRoot,
                encoding: 'utf8'
            });

            if (result.status !== 0) {
                process.stdout.write(result.stdout || '');
                process.stderr.write(result.stderr || '');
                throw new Error(`sf command failed for ${entry.label}`);
            }

            printSfSummary(`${result.stdout || ''}\n${result.stderr || ''}`);
        }
    }
}

try {
    run();
} catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
}
