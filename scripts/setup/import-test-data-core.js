const path = require('node:path');

const defaultPlan = 'scripts/setup/import-plan.json';

function readOptionValue(argv, index, option) {
    const value = argv[index + 1];

    if (value === undefined || value.startsWith('-')) {
        throw new Error(`${option} requires a value.`);
    }

    return value;
}

function parseArgs(argv) {
    const args = {
        defaultRepeat: null,
        dryRun: false,
        help: false,
        only: null,
        plan: defaultPlan,
        repeat: null,
        targetOrg: null
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--dry-run') {
            args.dryRun = true;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            args.help = true;
            continue;
        }

        if (arg === '--plan') {
            args.plan = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }

        if (arg === '--default-repeat') {
            args.defaultRepeat = Number(readOptionValue(argv, index, arg));
            index += 1;
            continue;
        }

        if (arg === '--only') {
            args.only = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }

        if (arg === '--repeat') {
            args.repeat = Number(readOptionValue(argv, index, arg));
            index += 1;
            continue;
        }

        if (arg === '--target-org' || arg === '-o') {
            args.targetOrg = readOptionValue(argv, index, arg);
            index += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return args;
}

function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${label} must be a positive integer.`);
    }
}

function resolveInsideRepo(repoRoot, relativePath) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
        throw new Error('Repository-relative path must be a non-empty string.');
    }

    const absolutePath = path.resolve(repoRoot, relativePath);
    const relative = path.relative(repoRoot, absolutePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Path must stay inside the repository: ${relativePath}`);
    }

    return absolutePath;
}

function readPlan({ fileSystem, planPath, repoRoot }) {
    const absolutePlanPath = resolveInsideRepo(repoRoot, planPath);
    const plan = JSON.parse(fileSystem.readFileSync(absolutePlanPath, 'utf8'));

    if (!Array.isArray(plan.imports) || plan.imports.length === 0) {
        throw new Error('Import plan must contain a non-empty imports array.');
    }

    const labels = plan.imports.map((entry) => entry.label).filter(Boolean);
    if (new Set(labels).size !== labels.length) {
        throw new Error('Import plan entry labels must be unique.');
    }

    return plan;
}

function getSelectedEntries(plan, only) {
    const entries = only ? plan.imports.filter((entry) => entry.label === only) : plan.imports;

    if (entries.length === 0) {
        throw new Error(`No import plan entries matched --only ${only}`);
    }

    return entries;
}

function getSourcePaths(plan, entry) {
    const requiredKeys = ['label', 'operation', 'file'];
    const missingKeys = requiredKeys.filter((key) => !entry[key]);

    if (missingKeys.length > 0) {
        throw new Error(`Plan entry is missing required keys: ${missingKeys.join(', ')}`);
    }

    if (entry.operation !== 'apex') {
        throw new Error(`Unsupported operation for ${entry.label}: ${entry.operation}`);
    }

    if (entry.standalone) {
        return [entry.file];
    }

    if (!plan.preamble) {
        throw new Error(`Import plan must define a preamble for ${entry.label}.`);
    }

    return [plan.preamble, entry.file];
}

function readApexSource({ entry, fileSystem, plan, repoRoot }) {
    const sourcePaths = getSourcePaths(plan, entry);
    const sourceParts = sourcePaths.map((sourcePath) => {
        const absolutePath = resolveInsideRepo(repoRoot, sourcePath);

        if (!fileSystem.existsSync(absolutePath)) {
            throw new Error(`Apex file does not exist for ${entry.label}: ${sourcePath}`);
        }

        const content = fileSystem.readFileSync(absolutePath, 'utf8').trim();

        if (content.length === 0) {
            throw new Error(`Apex file must not be empty: ${sourcePath}`);
        }

        return content;
    });

    return {
        source: `${sourceParts.join('\n\n')}\n`,
        sourcePaths
    };
}

function buildSfArgs(absoluteFilePath, targetOrg) {
    return ['apex', 'run', '--file', absoluteFilePath, '--target-org', targetOrg];
}

function extractSfSummary(output) {
    return output
        .split(/\r?\n/)
        .filter((line) => /USER_DEBUG\|.*\|(DEBUG)\|(Seed run key|Created records|Skipped records):/.test(line))
        .map((line) => line.replace(/^.*\|DEBUG\|/, ''));
}

function prepareEntries({ args, fileSystem, plan, repoRoot }) {
    const defaultRepeat = args.defaultRepeat ?? plan.repeat ?? 1;

    assertPositiveInteger(defaultRepeat, 'Default repeat count');

    return getSelectedEntries(plan, args.only).map((entry) => {
        const repeatCount = args.repeat ?? entry.repeat ?? defaultRepeat;

        assertPositiveInteger(repeatCount, `Repeat count for ${entry.label}`);
        return {
            entry,
            repeatCount,
            ...readApexSource({ entry, fileSystem, plan, repoRoot })
        };
    });
}

module.exports = {
    assertPositiveInteger,
    buildSfArgs,
    defaultPlan,
    extractSfSummary,
    getSelectedEntries,
    getSourcePaths,
    parseArgs,
    prepareEntries,
    readApexSource,
    readPlan,
    resolveInsideRepo
};
