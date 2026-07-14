function runNoArgumentCommand({ argv, usage, execute, stdout = process.stdout, stderr = process.stderr }) {
    if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
        stdout.write(`${usage.trimEnd()}\n`);
        return 0;
    }

    if (argv.length > 0) {
        stderr.write(`Error: Unknown argument(s): ${argv.join(', ')}\n`);
        stderr.write(`${usage.trimEnd()}\n`);
        return 1;
    }

    const executeExitCode = execute();
    return executeExitCode ?? 0;
}

module.exports = {
    runNoArgumentCommand
};
