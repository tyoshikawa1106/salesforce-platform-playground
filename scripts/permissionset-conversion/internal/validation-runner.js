// 実行方法: Profile変換スクリプトから生成後の手動コマンド表示に使用する。
// 用途: 組織へ接続せず、今回のPermission Set出力だけを対象とする後続コマンドを作る。

const path = require('node:path');

// 実行場所に依存しない安全なsource directory表記へ変換する。
function getRelativeSourceDirectory({ projectRoot, sourceDirectory }) {
    const relativeSourceDirectory = path.relative(projectRoot, sourceDirectory);

    if (
        relativeSourceDirectory.length === 0 ||
        relativeSourceDirectory === '..' ||
        relativeSourceDirectory.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeSourceDirectory)
    ) {
        throw new Error('Permission Set出力先がリポジトリ配下ではありません。');
    }

    return relativeSourceDirectory.split(path.sep).join('/');
}

// ProductionまたはDeveloper Editionで利用する手動validateコマンドを作る。
function getProductionValidationCommand({ projectRoot, sourceDirectory }) {
    const normalizedSourceDirectory = getRelativeSourceDirectory({ projectRoot, sourceDirectory });

    return `sf project deploy validate --source-dir ${normalizedSourceDirectory} --test-level RunLocalTests --wait 30 --target-org <alias>`;
}

// SandboxまたはScratch Orgで利用する手動dry-runコマンドを作る。
function getSandboxValidationCommand({ projectRoot, sourceDirectory }) {
    const normalizedSourceDirectory = getRelativeSourceDirectory({ projectRoot, sourceDirectory });

    return `sf project deploy start --dry-run --source-dir ${normalizedSourceDirectory} --test-level RunLocalTests --wait 30 --target-org <alias>`;
}

// 今回生成したフォルダだけを選択した組織へ手動deployするコマンドを作る。
function getDeploymentCommand({ projectRoot, sourceDirectory }) {
    const normalizedSourceDirectory = getRelativeSourceDirectory({ projectRoot, sourceDirectory });

    return `sf project deploy start --source-dir ${normalizedSourceDirectory} --wait 30 --target-org <alias>`;
}

// 手動deploy後に組織へ保存されたPermission Setを再取得して比較するコマンドを作る。
function getVerificationCommand({ projectRoot, sourceDirectory, targetOrg = '<alias>' }) {
    const normalizedSourceDirectory = getRelativeSourceDirectory({ projectRoot, sourceDirectory });

    return `npm run sf:verify:permissionsets -- --source-dir ${normalizedSourceDirectory} --target-org ${targetOrg}`;
}

module.exports = {
    getDeploymentCommand,
    getProductionValidationCommand,
    getSandboxValidationCommand,
    getVerificationCommand
};
