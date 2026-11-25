// 実行コマンド: node scripts/scratch-org/steps/assign-permission-set.js [--alias <alias>]
// 用途: setup.jsから呼び出し、Scratch OrgへPermission Setを割り当てる。

const { runSf, runSfWithOutput } = require('../../common/run-command');
const { getTargetOrgInfo, orgTypes, parseSfJson } = require('../../common/target-org');
const { repoRoot, scratchOrg } = require('../internal/context');
const { runAliasCommand } = require('../internal/command');

// helpと引数エラーで同じ実行例を表示する。
const usage = '実行コマンド: node scripts/scratch-org/steps/assign-permission-set.js [--alias <alias>]';

// 設定ファイルで指定したPermission SetをScratch Orgの実行ユーザーへ割り当てる。
function main({ argv = process.argv.slice(2), runSfCommand = runSf, runSfQuery = runSfWithOutput } = {}) {
    // 未指定時は再現設定のaliasを使い、指定時は検証済みaliasへ限定する。
    return runAliasCommand({
        argv,
        defaultAlias: scratchOrg.alias,
        usage,
        execute(alias) {
            // 単独実行でも権限付与先がScratch Orgであることを確認する。
            const orgInfo = getTargetOrgInfo({ repoRoot, runSfCommand: runSfQuery, targetOrg: alias });
            // 通常組織のユーザーには再構築用の権限を付与しない。
            if (orgInfo.type !== orgTypes.SCRATCH) {
                throw new Error('再構築用の権限割り当てはScratch Orgだけに実行できます。');
            }
            // 途中再開でも、確認済みの本人への有効な直接割り当てだけを既存と扱う。
            const username = orgInfo.username.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
            // 同名の管理パッケージやグループ経由の権限を既存割り当てに含めない。
            const query = `SELECT PermissionSet.Name FROM PermissionSetAssignment WHERE Assignee.Username = '${username}' AND PermissionSetGroupId = null AND PermissionSet.NamespacePrefix = null AND IsActive = true`;
            // 割り当てに成功した直後の再実行でも重複エラーを発生させない。
            const result = parseSfJson(
                runSfQuery(['data', 'query', '--target-org', orgInfo.username, '--query', query, '--json'], repoRoot),
                '利用権限の割り当て確認'
            );
            // 不完全な照会で既存割り当てを見落とさない。
            if (
                !Array.isArray(result?.records) ||
                result.totalSize !== result.records.length ||
                result.records.some((row) => typeof row.PermissionSet?.Name !== 'string')
            )
                throw new Error('利用権限の割り当てを確認できません。');
            // 設定したメンバーだけを割り当て対象として比較する。
            const assigned = new Set(result.records.map((row) => row.PermissionSet.Name));
            // 新規と途中からの再開は同じ定義リストを使用する。
            const missing = scratchOrg.permissionSets.filter((name) => !assigned.has(name));
            // 全件そろっていれば後続ステップに進む。
            if (!missing.length) return 0;
            // 権限セット名を個別のオプションに変換する。
            const permissionSetArgs = missing.flatMap((name) => ['--name', name]);
            // 一部の割り当て失敗も終了状態へ反映し、後続のデータ投入を停止する。
            return runSfCommand(
                [
                    'org',
                    'assign',
                    'permset',
                    // 設定済みの利用権限をまとめて指定する。
                    ...permissionSetArgs,
                    // 呼び出し元から受け取った組織へ割り当て先を限定する。
                    '--target-org',
                    orgInfo.username,
                    '--json'
                ],
                repoRoot
            );
        }
    });
}

// コマンドとして実行された場合だけPermission Setを割り当てる。
if (require.main === module) {
    // setup.jsが引数エラーと割り当て失敗を検知できる終了状態にする。
    process.exitCode = main();
}

// CLI引数の組み立てを組織接続なしでテストできるようmainを公開する。
module.exports = { main };
