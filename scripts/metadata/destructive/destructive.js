// 実行コマンド: npm run sf:destructive
// 用途: Default Target Orgを確認・承認し、dry-run成功後に同じ対象のメタデータを削除する。

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApprovalPrompt, isApproved } = require('../../common/approval');
const { setImmediate: yieldToEvents } = require('node:timers/promises');
const { runSfWithOutput, runSfWithOutputAsync } = require('../../common/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, orgTypes, printTargetOrgInfo } = require('../../common/target-org');
const { deployOperations, registerInterruptHandler, runAndMonitorDeploy } = require('./internal/deploy-runner');

// manifestとSalesforce CLIの作業場所をリポジトリルートに揃える。
const defaultRepoRoot = path.resolve(__dirname, '../../..');

// 削除deployに必要な通常manifestと、実際の削除対象を定義するmanifestを分ける。
const packageManifest = 'manifest/destructivePackage.xml';
// 削除対象の読み込み元を指定する。
const destructiveManifest = 'manifest/destructiveChanges.xml';

// 削除対象manifestに明示的な対象が設定されていることを組織照合前に確認する。
function validateDestructiveManifest({
    readFileSync = fs.readFileSync,
    contents = readFileSync(path.join(defaultRepoRoot, destructiveManifest))
} = {}) {
    // XMLの内容を文字列として検証する。
    const manifest = contents.toString('utf8');

    // 作業用プレースホルダーを実在するmetadata名として扱わない。
    if (manifest.includes('REPLACE_WITH_')) {
        throw new Error('manifest/destructiveChanges.xmlにプレースホルダーが残っています。');
    }

    // types要素の開始と終了が一致しないmanifestを部分的に解釈しない。
    const openingTypeCount = manifest.match(/<types>/g)?.length ?? 0;
    // 閉じタグ数を数えて開始タグ数と照合する。
    const closingTypeCount = manifest.match(/<\/types>/g)?.length ?? 0;

    // 削除対象が空または不完全な状態では組織確認やSalesforce CLIを開始しない。
    if (openingTypeCount === 0 || openingTypeCount !== closingTypeCount) {
        throw new Error('manifest/destructiveChanges.xmlに削除対象が設定されていません。');
    }

    // 各metadata typeの要素を個別に検査する。
    for (const match of manifest.matchAll(/<types>([\s\S]*?)<\/types>/g)) {
        // 検査するtypes要素の内容を取り出す。
        const typeBody = match[1];
        // 空白を除いたmetadata type名を列挙する。
        const names = [...typeBody.matchAll(/<name>\s*([^<]+?)\s*<\/name>/g)].map((nameMatch) => nameMatch[1].trim());
        // 明示指定された削除対象名を列挙する。
        const members = [...typeBody.matchAll(/<members>\s*([^<]+?)\s*<\/members>/g)].map((memberMatch) =>
            memberMatch[1].trim()
        );

        // type名を推測せず、1つのnameと1件以上のmembersがある場合だけ許可する。
        if (names.length !== 1 || names[0] === '' || members.length === 0 || members.some((member) => member === '')) {
            throw new Error('manifest/destructiveChanges.xmlの削除対象形式が不正です。');
        }

        // ワイルドカードでは削除範囲を個別指定できないため許可しない。
        if (members.includes('*')) {
            throw new Error('manifest/destructiveChanges.xmlの削除対象にワイルドカードは使用できません。');
        }
    }
}

// 接続先と組織種別を確認し、必要な承認後にdry-runと実削除を順に実行する。
async function main({
    argv = process.argv.slice(2),
    repoRoot = defaultRepoRoot,
    createPrompt,
    runSfWithOutputCommand = runSfWithOutput,
    runSfWithOutputAsyncCommand = runSfWithOutputAsync,
    registerInterrupt = registerInterruptHandler,
    validateManifest = validateDestructiveManifest,
    runDeployCommand = runAndMonitorDeploy,
    writeLine = console.log
} = {}) {
    // Target Orgや実行方法を外部引数で差し替えない。
    if (argv.length !== 0) {
        // 不正な引数と利用可能なコマンドを通知する。
        console.error('エラー: このスクリプトは引数を受け付けません。');
        // 引数なしの起動方法を案内する。
        console.error('実行コマンド: npm run sf:destructive');
        // 組織への接続前に異常終了する。
        return 1;
    }

    // 承認待ちやdry-run中の編集が削除対象に反映されないよう、最初に内容を確定する。
    const destructiveContents = fs.readFileSync(path.join(repoRoot, destructiveManifest));
    // 後でCLIへ渡す内容そのものを組織照合前に検査する。
    validateManifest({ contents: destructiveContents });
    // 通常manifestも同じ実行の入力として保持する。
    const packageContents = fs.readFileSync(path.join(repoRoot, packageManifest));

    // Default Target Orgのaliasまたはusernameを認証済み組織と照合する。
    const defaultTarget = getDefaultTargetOrg({ repoRoot, runSfCommand: runSfWithOutputCommand });
    // 承認に使う組織情報と種別を確定する。
    const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfWithOutputCommand, targetOrg: defaultTarget });
    // aliasの割り当てが変わっても、開始と監視には確認画面のusernameを使う。
    const targetOrg = orgInfo.username;

    // 実行者が接続先を確認できるよう、必要な組織情報だけを表示する。
    printTargetOrgInfo(orgInfo);

    // 追加承認が必要な組織種別を判別する。
    const isProductionLike = orgInfo.type === orgTypes.PRODUCTION || orgInfo.type === orgTypes.DEVELOPER_EDITION;

    // 接続先と組織種別の確認入力を受け付ける。
    const prompt = createApprovalPrompt(createPrompt);

    // 承認入力中の例外でもpromptを閉じられるようfinallyで管理する。
    try {
        // 表示された接続組織を実行者が承認した場合だけ組織種別の確認へ進む。
        const targetAnswer = await prompt.question('この接続組織で続行しますか？ [y/N]: ');

        // 明示承認以外では組織へ変更を加えない。
        if (!isApproved(targetAnswer)) {
            // 承認されなかったことを操作結果として明示する。
            console.log('メタデータ削除を中止しました。');
            // 正常な利用者中止として0を返す。
            return 0;
        }

        // 本番環境とDeveloper Editionでは、dry-runより前に環境別の追加確認を行う。
        if (isProductionLike) {
            // 接続先の承認だけで高リスク環境の削除を許可しない。
            const environmentAnswer = await prompt.question(
                `${orgInfo.typeLabel}です。メタデータ削除を実行してよろしいですか？ [y/N]: `
            );

            // 環境別の明示承認がない場合はdry-runも開始しない。
            if (!isApproved(environmentAnswer)) {
                // 環境別の承認がなかったことを操作結果として明示する。
                console.log('メタデータ削除を中止しました。');
                // 正常な利用者中止として0を返す。
                return 0;
            }
        }
    } finally {
        // 全承認の終了後にraw入力を解除し、端末のCtrl+CをSIGINTとして受け付ける。
        prompt.close();
    }

    // dry-runから実削除まで同じ中断状態を保持する。
    const controller = new AbortController();
    // 承認完了後に登録したハンドラーをfinallyで解除する。
    let unregisterInterrupt = () => {};

    // 承認後にだけ、この実行のCLIに渡す一時ファイルの保存先を作る。
    const manifestDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-destructive-'));
    try {
        // 通常manifestの一時ファイル名を決める。
        const packagePath = path.join(manifestDirectory, path.basename(packageManifest));
        // 削除対象manifestは別ファイルとしてCLIへ渡す。
        const destructivePath = path.join(manifestDirectory, path.basename(destructiveManifest));
        // 実行開始時の通常manifestを書き出す。
        fs.writeFileSync(packagePath, packageContents);
        // 組織照合前に検査した削除対象をそのまま書き出す。
        fs.writeFileSync(destructivePath, destructiveContents);
        // 通常manifestと削除対象manifestを明示し、テストレベルはSalesforce標準の判定に任せる。
        const deployArgs = [
            'project',
            'deploy',
            'start',
            '--manifest',
            packagePath,
            '--post-destructive-changes',
            destructivePath,
            '--target-org',
            targetOrg
        ];

        // 開始待ちと実削除への移行を含めてSIGINTを受け付ける。
        unregisterInterrupt = registerInterrupt(() => controller.abort());
        // 検証の開始を表示する。
        writeLine('dry-runによるメタデータ削除の検証を開始します。');

        // 同じsignalを渡し、CLI開始から監視完了まで中断可能にする。
        const dryRunStatus = await runDeployCommand({
            deployArgs,
            operation: deployOperations.DRY_RUN,
            targetOrg,
            repoRoot,
            runSfWithOutputCommand: runSfWithOutputAsyncCommand,
            signal: controller.signal
        });
        // 中断を含む非0終了を変更せず返し、実削除へ進まない。
        if (dryRunStatus !== 0) {
            return dryRunStatus;
        }
        // 成功直前に届いたSIGINTも実削除の開始前に処理する。
        await yieldToEvents();
        // dry-run完了後の中断も実削除開始を禁止する。
        if (controller.signal.aborted) {
            writeLine('メタデータの実削除を開始する前に中断しました。');
            return 130;
        }

        // 完了した検証の結果を表示する。
        writeLine('dry-runによるメタデータ削除の検証が成功しました。');
        // dry-runから実削除への移行を通知する。
        writeLine('メタデータの実削除を開始します。');

        // dry-run成功後は、同じ対象組織・manifestをそのまま実削除へ引き渡す。
        const deployStatus = await runDeployCommand({
            deployArgs,
            operation: deployOperations.DEPLOY,
            targetOrg,
            repoRoot,
            runSfWithOutputCommand: runSfWithOutputAsyncCommand,
            signal: controller.signal
        });

        // 実削除が成功した場合だけ完了と事後確認を案内する。
        if (deployStatus === 0) {
            writeLine('メタデータの削除が完了しました。');
            writeLine('削除後の確認としてApexテストの実行を推奨します: npm run sf:test:apex');
        }

        // 監視結果を終了コードとして返す。
        return deployStatus;
    } finally {
        // 実削除への移行まで保持した中断ハンドラーを解除する。
        unregisterInterrupt();
        // 終了、中断、書き込みやCLIの失敗時もこの実行のコピーを削除する。
        fs.rmSync(manifestDirectory, { recursive: true, force: true });
    }
}

// destructive deployを開始 (テストスクリプトからの実行の場合はSkip)
if (require.main === module) {
    // Promiseの完了を待ち、mainが決定した成否をプロセスへ反映する。
    main()
        .then((status) => {
            // npmが中止・成功・失敗を区別できるようmainの結果を反映する。
            process.exitCode = status;
        })
        .catch((error) => {
            // 確認入力を処理できない場合も、原因だけを簡潔に表示する。
            console.error(`エラー: destructive deployを開始できませんでした: ${error.message}`);
            // npmへ実行失敗を通知する。
            process.exitCode = 1;
        });
}

// manifest検証と確認分岐を組織接続なしでテストできるよう公開する。
module.exports = { main, validateDestructiveManifest };
