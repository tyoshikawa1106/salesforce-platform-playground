#!/usr/bin/env node
// Run: npm run setup:data:standard:dry-run
// Run: npm run setup:data:standard -- --target-org <alias>

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = process.cwd();
const defaultPlan = 'scripts/setup/standard-objects/import-plan.json';

// CLI 引数を読む。実処理は run() に集約し、ここでは値の取り出しだけを行う。
function parseArgs(argv) {
    const args = {
        defaultRepeat: null,
        dryRun: false,
        plan: defaultPlan,
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

        if (arg === '--default-repeat') {
            args.defaultRepeat = Number(argv[index + 1]);
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

// plan から参照するファイルはリポジトリ内に限定する。
function resolveInsideRepo(relativePath) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    const relative = path.relative(repoRoot, absolutePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Path must stay inside the repository: ${relativePath}`);
    }

    return absolutePath;
}

// import plan は、実行する anonymous Apex の順序を定義する。
function readPlan(planPath) {
    const absolutePlanPath = resolveInsideRepo(planPath);
    const raw = fs.readFileSync(absolutePlanPath, 'utf8');
    const plan = JSON.parse(raw);

    if (!Array.isArray(plan.imports) || plan.imports.length === 0) {
        throw new Error('Import plan must contain a non-empty imports array.');
    }

    return plan;
}

// repeat は 1 以上の整数だけ許可する。
function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${label} must be a positive integer.`);
    }
}

// --only が指定された場合は、対象 label の entry だけを実行する。
function getSelectedEntries(plan, only) {
    const entries = only ? plan.imports.filter((entry) => entry.label === only) : plan.imports;

    if (entries.length === 0) {
        throw new Error(`No import plan entries matched --only ${only}`);
    }

    return entries;
}

// このランナーでは Apex script の実行だけを扱う。
function validatePlanEntry(entry) {
    const requiredKeys = ['label', 'operation', 'file'];
    const missingKeys = requiredKeys.filter((key) => !entry[key]);

    if (missingKeys.length > 0) {
        throw new Error(`Plan entry is missing required keys: ${missingKeys.join(', ')}`);
    }

    if (entry.operation !== 'apex') {
        throw new Error(`Unsupported operation for ${entry.label}: ${entry.operation}`);
    }

    const absoluteFilePath = resolveInsideRepo(entry.file);

    if (!fs.existsSync(absoluteFilePath)) {
        throw new Error(`Apex file does not exist for ${entry.label}: ${entry.file}`);
    }

    const fileContent = fs.readFileSync(absoluteFilePath, 'utf8');

    if (fileContent.trim().length === 0) {
        throw new Error(`Apex file must not be empty: ${entry.file}`);
    }

    return absoluteFilePath;
}

// Salesforce CLI に渡す sf apex run の引数を作る。
function buildSfArgs(entry, absoluteFilePath, targetOrg) {
    return ['apex', 'run', '--file', absoluteFilePath, '--target-org', targetOrg];
}

// anonymous Apex の debug log から、seed 結果の要約だけを表示する。
function printSfSummary(output) {
    const summaryLines = output
        .split(/\r?\n/)
        .filter((line) => /USER_DEBUG\|.*\|(DEBUG)\|(Seed run key|Created records|Skipped records):/.test(line))
        .map((line) => line.replace(/^.*\|DEBUG\|/, ''));

    for (const line of summaryLines) {
        writeLine(line);
    }
}

// dry-run と実行時で同じ形式のステップ表示にする。
function printStep(entry, cycle, repeatCount, sfArgs, dryRun) {
    const cycleSuffix = repeatCount > 1 ? ` (${cycle}/${repeatCount})` : '';
    writeLine(`[${dryRun ? 'dry-run' : 'import'}] ${entry.label}${cycleSuffix}`);
    writeLine(`sf ${sfArgs.join(' ')}`);
}

// 1 つの anonymous Apex ファイルを Salesforce CLI で実行する。
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

    printSfSummary(`${result.stdout || ''}\n${result.stderr || ''}`);
}

function run() {
    const args = parseArgs(process.argv.slice(2));
    const plan = readPlan(args.plan);
    const selectedEntries = getSelectedEntries(plan, args.only);
    const defaultRepeat = args.defaultRepeat ?? plan.repeat ?? 1;

    if (!args.dryRun && !args.targetOrg) {
        throw new Error('Real import requires --target-org <alias>. Use --dry-run to validate locally.');
    }

    assertPositiveInteger(defaultRepeat, 'Default repeat count');

    for (const entry of selectedEntries) {
        // 優先順位: --repeat > entry.repeat > --default-repeat > plan.repeat > 1
        const repeatCount = args.repeat ?? entry.repeat ?? defaultRepeat;
        const absoluteFilePath = validatePlanEntry(entry);
        const targetOrg = args.targetOrg || '<target-org>';
        const sfArgs = buildSfArgs(entry, absoluteFilePath, targetOrg);

        assertPositiveInteger(repeatCount, `Repeat count for ${entry.label}`);

        for (let cycle = 1; cycle <= repeatCount; cycle += 1) {
            printStep(entry, cycle, repeatCount, sfArgs, args.dryRun);
            if (args.dryRun) {
                continue;
            }
            runSfCommand(entry, sfArgs);
        }
    }
}

try {
    run();
} catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
}
