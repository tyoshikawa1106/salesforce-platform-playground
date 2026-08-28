// 実行コマンド: npm run sf:destructive
// 用途: Default Target Orgを確認・承認し、dry-run成功後に同じ対象のメタデータを削除する。

const fs = require('node:fs');
const path = require('node:path');
const { createApprovalPrompt, isApproved } = require('../../common/approval');
const { runSfWithOutput } = require('../../common/run-command');
const { getDefaultTargetOrg, getTargetOrgInfo, orgTypes, printTargetOrgInfo } = require('../../common/target-org');
const { deployOperations, runAndMonitorDeploy } = require('./internal/deploy-runner');

// manifestとSalesforce CLIの作業場所をリポジトリルートに揃える。
const repoRoot = path.resolve(__dirname, '../../..');

// 削除deployに必要な通常manifestと、実際の削除対象を定義するmanifestを分ける。
const packageManifest = 'manifest/destructivePackage.xml';
const destructiveManifest = 'manifest/destructiveChanges.xml';

// 削除対象manifestに明示的な対象が設定されていることを組織照合前に確認する。
function validateDestructiveManifest({ readFileSync = fs.readFileSync } = {}) {
    // 実行場所に依存せずリポジトリ管理の削除対象manifestを読み込む。
    const manifestPath = path.join(repoRoot, destructiveManifest);
    // XMLの内容を文字列として検証する。
    const manifest = readFileSync(manifestPath, 'utf8');

    // 作業用プレースホルダーを実在するmetadata名として扱わない。
    if (manifest.includes('REPLACE_WITH_')) {
        throw new Error('manifest/destructiveChanges.xmlにプレースホルダーが残っています。');
    }

    // types要素の開始と終了が一致しないmanifestを部分的に解釈しない。
    const openingTypeCount = manifest.match(/<types>/g)?.length ?? 0;
    const closingTypeCount = manifest.match(/<\/types>/g)?.length ?? 0;

    // 削除対象が空または不完全な状態では組織確認やSalesforce CLIを開始しない。
    if (openingTypeCount === 0 || openingTypeCount !== closingTypeCount) {
        throw new Error('manifest/destructiveChanges.xmlに削除対象が設定されていません。');
    }

    for (const match of manifest.matchAll(/<types>([\s\S]*?)<\/types>/g)) {
        const typeBody = match[1];
        const names = [...typeBody.matchAll(/<name>\s*([^<]+?)\s*<\/name>/g)].map((nameMatch) => nameMatch[1].trim());
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
    createPrompt,
    runSfWithOutputCommand = runSfWithOutput,
    validateManifest = validateDestructiveManifest,
    runDeployCommand = runAndMonitorDeploy,
    writeLine = console.log
} = {}) {
    // Target Orgや実行方法を外部引数で差し替えない。
    if (argv.length !== 0) {
        console.error('エラー: このスクリプトは引数を受け付けません。');
        console.error('実行コマンド: npm run sf:destructive');
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

        // 通常manifestと削除対象manifestを明示し、テストレベルはSalesforce標準の判定に任せる。
        const deployArgs = [
            'project',
            'deploy',
            'start',
            '--manifest',
            packageManifest,
            '--post-destructive-changes',
            destructiveManifest,
            '--target-org',
            targetOrg
        ];

        writeLine('dry-runによるメタデータ削除の検証を開始します。');

        // dry-runが失敗した場合は実削除せずに終了する。
        if (
            (await runDeployCommand({
                deployArgs,
                operation: deployOperations.DRY_RUN,
                targetOrg,
                repoRoot,
                runSfWithOutputCommand
            })) !== 0
        ) {
            // dry-run失敗を呼び出し元へ伝える。
            return 1;
        }

        writeLine('dry-runによるメタデータ削除の検証が成功しました。');
        writeLine('メタデータの実削除を開始します。');

        // dry-run成功後は、同じ対象組織・manifestをそのまま実削除へ引き渡す。
        const deployStatus = await runDeployCommand({
            deployArgs,
            operation: deployOperations.DEPLOY,
            targetOrg,
            repoRoot,
            runSfWithOutputCommand
        });

        if (deployStatus === 0) {
            writeLine('メタデータの削除が完了しました。');
            writeLine('削除後の確認としてApexテストの実行を推奨します: npm run sf:test:apex');
        }

        return deployStatus;
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
