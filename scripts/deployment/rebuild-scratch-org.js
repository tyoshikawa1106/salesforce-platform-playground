#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');

const defaults = {
    alias: 'scratch-platform-playground',
    durationDays: '7',
    wait: '30'
};

function parseArgs(argv) {
    const options = {
        alias: defaults.alias,
        durationDays: defaults.durationDays,
        wait: defaults.wait,
        targetDevHub: null,
        packageIds: [],
        keepOrg: false,
        skipCreate: false,
        skipGeneratedPolicy: false,
        skipTests: false
    };

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        switch (arg) {
            case '--alias':
                options.alias = readValue(argv, ++index, arg);
                break;
            case '--duration-days':
                options.durationDays = readValue(argv, ++index, arg);
                break;
            case '--wait':
                options.wait = readValue(argv, ++index, arg);
                break;
            case '--target-dev-hub':
                options.targetDevHub = readValue(argv, ++index, arg);
                break;
            case '--package':
                options.packageIds.push(readValue(argv, ++index, arg));
                break;
            case '--keep-org':
                options.keepOrg = true;
                break;
            case '--skip-create':
                options.skipCreate = true;
                break;
            case '--skip-generated-policy':
                options.skipGeneratedPolicy = true;
                break;
            case '--skip-tests':
                options.skipTests = true;
                break;
            case '--help':
                printUsage();
                process.exit(0);
                break;
            default:
                console.error(`Unknown option: ${arg}`);
                printUsage();
                process.exit(1);
        }
    }

    return options;
}

function readValue(argv, index, optionName) {
    const value = argv[index];
    if (!value || value.startsWith('--')) {
        console.error(`Missing value for ${optionName}`);
        process.exit(1);
    }
    return value;
}

function printUsage() {
    console.log(`Usage: node scripts/deployment/rebuild-scratch-org.js [options]

Options:
  --alias <alias>              Scratch Org alias. Default: ${defaults.alias}
  --duration-days <days>       Scratch Org duration. Default: ${defaults.durationDays}
  --wait <minutes>             Deploy/test wait minutes. Default: ${defaults.wait}
  --target-dev-hub <alias>     Dev Hub alias when the default Dev Hub is not used
  --package <04t...>           Package version id to install before metadata deploy. Repeatable
  --keep-org                   Keep the Scratch Org after verification
  --skip-create                Reuse an existing Scratch Org alias
  --skip-generated-policy      Skip client credentials policy generation/deploy
  --skip-tests                 Skip RunLocalTests
  --help                       Show this help`);
}

function run(label, command, args) {
    console.log(`\n==> ${label}`);
    console.log([command, ...args].join(' '));
    try {
        execFileSync(command, args, {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: 'inherit'
        });
    } catch (error) {
        const status = error.status ?? 1;
        throw new RebuildError(label, status);
    }
}

function createScratchOrg(options) {
    const args = [
        'org',
        'create',
        'scratch',
        '--definition-file',
        'config/project-scratch-def.json',
        '--alias',
        options.alias,
        '--duration-days',
        options.durationDays
    ];

    if (options.targetDevHub) {
        args.push('--target-dev-hub', options.targetDevHub);
    }

    run('Create Scratch Org', 'sf', args);
}

function installPackages(options) {
    for (const packageId of options.packageIds) {
        run('Install package', 'sf', [
            'package',
            'install',
            '--package',
            packageId,
            '--target-org',
            options.alias,
            '--wait',
            options.wait,
            '--publish-wait',
            options.wait
        ]);
    }
}

function deployScratchMetadata(options) {
    run('Dry-run manifest deploy', 'sf', [
        'project',
        'deploy',
        'start',
        '--dry-run',
        '--manifest',
        'manifest/scratch-org-rebuild.xml',
        '--target-org',
        options.alias,
        '--wait',
        options.wait
    ]);

    run('Deploy manifest', 'sf', [
        'project',
        'deploy',
        'start',
        '--manifest',
        'manifest/scratch-org-rebuild.xml',
        '--target-org',
        options.alias,
        '--wait',
        options.wait
    ]);

    run('Dry-run scratch-org source deploy', 'sf', [
        'project',
        'deploy',
        'start',
        '--dry-run',
        '--source-dir',
        'scratch-org/main/default',
        '--target-org',
        options.alias,
        '--wait',
        options.wait
    ]);

    run('Deploy scratch-org source', 'sf', [
        'project',
        'deploy',
        'start',
        '--source-dir',
        'scratch-org/main/default',
        '--target-org',
        options.alias,
        '--wait',
        options.wait
    ]);
}

function deployGeneratedPolicy(options) {
    if (options.skipGeneratedPolicy) {
        console.log('\n==> Skip generated client credentials policy');
        return;
    }

    run('Generate client credentials policy', process.execPath, [
        'scripts/deployment/generate-client-credentials-policy.js',
        options.alias
    ]);

    const sourceDir = 'scratch-org/generated/client-credentials/main/default';
    run('Dry-run generated policy deploy', 'sf', [
        'project',
        'deploy',
        'start',
        '--dry-run',
        '--source-dir',
        sourceDir,
        '--target-org',
        options.alias,
        '--wait',
        options.wait
    ]);

    run('Deploy generated policy', 'sf', [
        'project',
        'deploy',
        'start',
        '--source-dir',
        sourceDir,
        '--target-org',
        options.alias,
        '--wait',
        options.wait
    ]);
}

function runApexTests(options) {
    if (options.skipTests) {
        console.log('\n==> Skip Apex RunLocalTests');
        return;
    }

    run('Run Apex local tests', 'sf', [
        'apex',
        'run',
        'test',
        '--test-level',
        'RunLocalTests',
        '--result-format',
        'human',
        '--target-org',
        options.alias,
        '--wait',
        options.wait
    ]);
}

function deleteScratchOrg(options, createdOrg) {
    if (options.keepOrg) {
        console.log(`\n==> Keeping Scratch Org: ${options.alias}`);
        return;
    }

    if (!createdOrg) {
        console.log(
            '\n==> Skip Scratch Org deletion because this run did not create it'
        );
        return;
    }

    run('Delete Scratch Org', 'sf', [
        'org',
        'delete',
        'scratch',
        '--target-org',
        options.alias,
        '--no-prompt'
    ]);
}

class RebuildError extends Error {
    constructor(step, status) {
        super(`Scratch Org rebuild failed during: ${step}`);
        this.name = 'RebuildError';
        this.step = step;
        this.status = status;
    }
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    let createdOrg = false;
    let exitCode = 0;

    try {
        if (!options.skipCreate) {
            createScratchOrg(options);
            createdOrg = true;
        }

        installPackages(options);
        deployScratchMetadata(options);
        deployGeneratedPolicy(options);
        runApexTests(options);
    } catch (error) {
        exitCode = error instanceof RebuildError ? error.status : 1;
        console.error(`\nError: ${error.message}`);
        if (error instanceof RebuildError) {
            console.error(`Failed step: ${error.step}`);
        }
    } finally {
        try {
            deleteScratchOrg(options, createdOrg);
        } catch (deleteError) {
            exitCode = exitCode || 1;
            console.error(`\nError: ${deleteError.message}`);
            console.error(
                `Scratch Org cleanup failed. Check alias manually: ${options.alias}`
            );
        }
        process.exitCode = exitCode;
    }
}

main();
