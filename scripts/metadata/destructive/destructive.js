// 実行コマンド: npm run sf:destructive
// 用途: Default Target Orgのメタデータ削除をdry-runし、承認後に実行する。

const fs = require('node:fs');
const path = require('node:path');
const { createApprovalPrompt, isApproved } = require('../../common/approval');
const { runSf, runSfWithOutput } = require('../../common/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, orgTypes, printTargetOrgInfo } = require('../../common/target-org');

// manifestとSalesforce CLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../../..');

// 削除deployに必要な通常manifestと、実際の削除対象を定義するmanifestを分ける。
const packageManifest = 'manifest/destructivePackage.xml';
const destructiveManifest = 'manifest/destructiveChanges.xml';

// 削除対象manifestに実在する対象だけが設定されていることを組織照合前に確認する。
function validateDestructiveManifest({ readFileSync = fs.readFileSync } = {}) {
    // 実行場所に依存せずリポジトリ管理の削除対象manifestを読み込む。
    const manifestPath = path.join(repoRoot, destructiveManifest);
    // XMLの内容を文字列として検証する。
    const manifest = readFileSync(manifestPath, 'utf8');

    // 作業用プレースホルダーを実在するmetadata名として扱わない。
    if (manifest.includes('REPLACE_WITH_')) {
        throw new Error('manifest/destructiveChanges.xmlにプレースホルダーが残っています。');
    }

    // 削除対象が空の状態では組織確認やSalesforce CLIを開始しない。
    if (!/<types>[\s\S]*?<members>[^<]+<\/members>[\s\S]*?<\/types>/.test(manifest)) {
        throw new Error('manifest/destructiveChanges.xmlに削除対象が設定されていません。');
    }
}

// 接続先と組織種別を確認し、dry-runの成功後に再承認された場合だけメタデータを削除する。
async function main({
    argv = process.argv.slice(2),
    createPrompt,
    runSfCommand = runSf,
    runSfWithOutputCommand = runSfWithOutput,
    validateManifest = validateDestructiveManifest
} = {}) {
    // このスクリプトは引数を受け付けない。
    if (argv.length !== 0) {
        // 引数指定が安全契約外であることを表示する。
        console.error('エラー: このスクリプトは引数を受け付けません。');
        // 正しいnpm scriptを利用者へ案内する。
        console.error('実行コマンド: npm run sf:destructive');
        // Salesforce CLIを呼び出さず失敗終了を返す。
        return 1;
    }

    // 削除対象が未設定またはプレースホルダーの場合は組織へ接続しない。
    validateManifest();

    // 削除対象のDefault Target Orgと、認証済み組織情報を取得する。
    const targetOrg = getDefaultTargetOrg({ repoRoot, runSfCommand: runSfWithOutputCommand });
    // aliasまたはusernameに一致する1組織の表示情報と種別を確定する。
    const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfWithOutputCommand, targetOrg });

    // 実行者が接続先を確認できるよう、必要な組織情報だけを表示する。
    printTargetOrgInfo(orgInfo);

    // 接続先、組織種別、実削除の確認入力を受け付ける。
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

        // 本番環境とDeveloper Editionでは、dry-runより前に環境別の最終確認を行う。
        if (orgInfo.type === orgTypes.PRODUCTION || orgInfo.type === orgTypes.DEVELOPER_EDITION) {
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

        // 通常manifestと削除対象manifestを明示してdestructive deployを組み立てる。
        const deployArgs = [
            'project',
            'deploy',
            'start',
            '--manifest',
            packageManifest,
            '--post-destructive-changes',
            destructiveManifest,
            '--target-org',
            targetOrg,
            '--wait',
            '30'
        ];

        // dry-runが失敗した場合は、実削除の確認を出さずに終了する。
        if (runSfCommand([...deployArgs, '--dry-run'], repoRoot) !== 0) {
            // dry-run失敗を呼び出し元へ伝える。
            return 1;
        }

        // dry-run成功後、実際に削除するか確認する。
        const deleteAnswer = await prompt.question('dry-runが成功しました。実際にメタデータを削除しますか？ [y/N]: ');

        // yまたはY以外の場合は実削除を中止する。
        if (!isApproved(deleteAnswer)) {
            // dry-run後の最終承認がなかったことを操作結果として明示する。
            console.log('メタデータの削除を中止しました。');
            // 正常な利用者中止として0を返す。
            return 0;
        }

        // dry-runと同じ対象組織・manifestだけを実削除へ引き渡す。
        return runSfCommand(deployArgs, repoRoot);
    } finally {
        // 中止やCLI失敗の場合も確認入力を終了する。
        prompt.close();
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
