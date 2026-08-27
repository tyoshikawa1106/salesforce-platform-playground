// 実行コマンド: node --test scripts/common/test/run-command.node.js
// 用途: Salesforce CLIとNode.js子スクリプトのOS別実行方法を検証する。

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildSfCommand, runNodeScript, runSf, runSfWithOutput } = require('../run-command');

// 外部処理をリポジトリルートで実行する。
const repoRoot = path.resolve(__dirname, '../../..');

test('macOSではSalesforce CLIを直接実行する', () => {
    // macOS向けのSalesforce CLI引数を準備する。
    const args = ['config', 'get', 'target-org'];

    // shellを経由せず、sfへ引数をそのまま渡すことを確認する。
    assert.deepEqual(buildSfCommand(args, 'darwin'), {
        command: 'sf',
        args
    });
});

test('WindowsではSalesforce CLIだけをcmd.exe経由で実行する', () => {
    // Windowsではsf.cmdを実行できるよう、cmd.exeだけを前置する。
    assert.deepEqual(buildSfCommand(['config', 'get', 'target-org'], 'win32'), {
        command: 'cmd.exe',
        args: ['/d', '/c', 'sf', 'config', 'get', 'target-org']
    });
});

test('Windowsでcmd.exeが解釈する文字をSalesforce CLIへ渡さない', () => {
    // 別コマンドや環境変数として解釈される文字と文字列以外の値を検証する。
    for (const unsafeArgument of [...'\r\n&|<>^%!"()']) {
        // 危険な引数はcmd.exeを起動する前に拒否する。
        assert.throws(
            () => buildSfCommand(['--target-org', `alias${unsafeArgument}`], 'win32'),
            /Windowsで使用できない文字が引数に含まれています/
        );
    }

    // 文字列以外の引数もcmd.exeへ渡さない。
    assert.throws(
        () => buildSfCommand(['--target-org', 123], 'win32'),
        /Windowsで使用できない文字が引数に含まれています/
    );
});

test('Salesforce CLIの終了コードを返す', () => {
    // 現在のOSで使用するSalesforce CLIコマンドを準備する。
    const sfCommand = buildSfCommand(['--version']);

    // Salesforce CLIの起動結果として終了コード7を返す。
    const status = runSf(['--version'], repoRoot, (command, args, options) => {
        assert.equal(command, sfCommand.command);
        assert.deepEqual(args, sfCommand.args);
        assert.deepEqual(options, { cwd: repoRoot, stdio: 'inherit' });
        return { status: 7 };
    });

    // 子プロセスの終了コードが維持されることを確認する。
    assert.equal(status, 7);
});

test('Salesforce CLIの実行時間上限を呼び出し側から指定する', () => {
    const timeout = 120_000;

    runSf(
        ['--version'],
        repoRoot,
        (_command, _args, options) => {
            assert.deepEqual(options, { cwd: repoRoot, stdio: 'inherit', timeout });
            return { status: 0 };
        },
        timeout
    );
});

test('Salesforce CLIを開始できない場合は異常終了する', () => {
    // エラー表示を記録し、子プロセス開始時の例外を再現する。
    const originalConsoleError = console.error;
    let errorMessage = '';
    console.error = (message) => {
        errorMessage = message;
    };

    try {
        const status = runSf([], repoRoot, () => {
            throw new Error('起動失敗');
        });

        // 日本語で原因を表示し、終了コード1を返すことを確認する。
        assert.equal(status, 1);
        assert.match(errorMessage, /エラー: sfを実行できませんでした: 起動失敗/);
    } finally {
        console.error = originalConsoleError;
    }
});

test('Salesforce CLIの起動結果にエラーがある場合は異常終了する', () => {
    // spawnSyncが返す起動エラーとエラー表示を記録する。
    const originalConsoleError = console.error;
    let errorMessage = '';
    console.error = (message) => {
        errorMessage = message;
    };

    try {
        const status = runSf([], repoRoot, () => ({ error: new Error('コマンドなし'), status: null }));

        // 起動エラーを終了コード1と日本語メッセージへ変換することを確認する。
        assert.equal(status, 1);
        assert.match(errorMessage, /エラー: sfを実行できませんでした: コマンドなし/);
    } finally {
        console.error = originalConsoleError;
    }
});

test('Salesforce CLIの出力を文字列として返す', () => {
    // 現在のOSで使用するSalesforce CLIコマンドを準備する。
    const sfCommand = buildSfCommand(['config', 'get', 'target-org']);

    // 呼び出し元で解析する標準出力と標準エラーを返す。
    const result = runSfWithOutput(['config', 'get', 'target-org'], repoRoot, (command, args, options) => {
        assert.equal(command, sfCommand.command);
        assert.deepEqual(args, sfCommand.args);
        assert.deepEqual(options, { cwd: repoRoot, encoding: 'utf8' });
        return { status: 0, stdout: 'target-org', stderr: '' };
    });

    // 出力と終了コードが変更されずに返ることを確認する。
    assert.deepEqual(result, { status: 0, stdout: 'target-org', stderr: '' });
});

test('Salesforce CLIの出力上限を呼び出し側から指定する', () => {
    // retrieveなど大きいJSON応答用の上限を準備する。
    const maxBuffer = 64 * 1024 * 1024;

    // 指定した上限だけをspawnSyncの実行設定へ追加する。
    runSfWithOutput(
        ['project', 'retrieve', 'start'],
        repoRoot,
        (_command, _args, options) => {
            assert.deepEqual(options, { cwd: repoRoot, encoding: 'utf8', maxBuffer });
            return { status: 0, stdout: '{}', stderr: '' };
        },
        maxBuffer
    );
});

test('出力取得用Salesforce CLIの実行時間上限を呼び出し側から指定する', () => {
    const timeout = 120_000;

    runSfWithOutput(
        ['project', 'deploy', 'report'],
        repoRoot,
        (_command, _args, options) => {
            assert.deepEqual(options, { cwd: repoRoot, encoding: 'utf8', timeout });
            return { status: 0, stdout: '{}', stderr: '' };
        },
        undefined,
        timeout
    );
});

test('出力取得用のSalesforce CLIを開始できない場合はエラー情報を返す', () => {
    // 子プロセス開始時の例外を再現する。
    const result = runSfWithOutput([], repoRoot, () => {
        throw new Error('起動失敗');
    });

    // 呼び出し元が同じ形式で失敗を判定できることを確認する。
    assert.equal(result.status, null);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    assert.match(result.error.message, /起動失敗/);
});

test('Node.js子スクリプトの終了コードを返す', () => {
    // 現在のNode.jsから終了コード7の子プロセスを実行する。
    const status = runNodeScript('-e', ['process.exit(7)'], repoRoot);

    // 子プロセスの終了コードが維持されることを確認する。
    assert.equal(status, 7);
});
