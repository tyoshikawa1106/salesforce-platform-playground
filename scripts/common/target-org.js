// 実行方法: 組織へ変更を加えるNodeスクリプトから読み込む。
// 用途: Salesforce CLIの認証済み組織一覧から対象組織を特定し、安全確認用の情報を返す。

// 組織操作の許可判定で使用する内部種別を変更不可にする。
const orgTypes = Object.freeze({
    DEVELOPER_EDITION: 'developer-edition',
    PRODUCTION: 'production',
    SANDBOX: 'sandbox',
    SCRATCH: 'scratch'
});

// 内部種別を、確認画面で誤認しにくい表示名へ対応付ける。
const orgTypeLabels = Object.freeze({
    [orgTypes.DEVELOPER_EDITION]: 'Developer Edition',
    [orgTypes.PRODUCTION]: '本番環境',
    [orgTypes.SANDBOX]: 'Sandbox',
    [orgTypes.SCRATCH]: 'Scratch Org'
});

// Salesforce CLIの実行結果を、安全判定に使用できるJSONへ変換する。
function parseSfJson(result, operation) {
    // プロセス開始エラーはSalesforce CLIが返したエラーと区別する。
    if (result.error) {
        throw new Error(`${operation}を開始できませんでした: ${result.error.message}`);
    }

    // 非0終了では不完全な標準出力を解析せずに中断する。
    if (result.status !== 0) {
        throw new Error(`${operation}に失敗しました。`);
    }

    // JSON解析エラーを対象操作名付きの診断へ変換する。
    let parsed;

    try {
        parsed = JSON.parse(result.stdout || '');
    } catch (error) {
        throw new Error(`${operation}のJSONを解析できませんでした: ${error.message}`);
    }

    // CLIがJSON本文で返した失敗も、組織判定へ進めない。
    if (parsed.status !== 0) {
        throw new Error(`${operation}でSalesforce CLIがエラーを返しました。`);
    }

    // CLI固有の外側構造を除き、各処理が必要とするresultだけを返す。
    return parsed.result;
}

// Default Target Orgとして設定されたaliasまたはusernameを取得する。
function getDefaultTargetOrg({ repoRoot, runSfCommand }) {
    // ローカル設定値をJSONで取得し、表示用コマンドへの依存を避ける。
    const result = parseSfJson(
        runSfCommand(['config', 'get', 'target-org', '--json'], repoRoot),
        'Default Target Orgの取得'
    );

    // 複数値や欠落を許さず、設定対象を一意に固定する。
    if (!Array.isArray(result) || result.length !== 1) {
        throw new Error('Default Target Orgを一意に取得できませんでした。');
    }

    // 取得した1件を後続の有効性検証へ渡す。
    const [targetOrg] = result;

    if (targetOrg.success !== true || typeof targetOrg.value !== 'string' || targetOrg.value.length === 0) {
        throw new Error('Default Target Orgが設定されていません。');
    }

    return targetOrg.value;
}

// aliasまたはusernameが実行対象と一致する組織だけを残す。
function matchesTargetOrg(org, targetOrg) {
    // 利用者が指定し得るaliasとusernameの両方を一致条件にする。
    return org.alias === targetOrg || org.username === targetOrg;
}

// 非Scratch組織をSandbox、Developer Edition、本番相当へ分類する。
function classifyNonScratchOrg(org, sandboxes) {
    // Sandbox一覧との突合に必要なOrg IDを必須にする。
    if (typeof org.orgId !== 'string' || org.orgId.length === 0) {
        throw new Error('対象組織のOrg IDを確認できませんでした。');
    }

    // isSandboxが欠落した組織を推測で本番相当に分類しない。
    if (typeof org.isSandbox !== 'boolean') {
        throw new Error('対象組織のSandbox情報を確認できませんでした。');
    }

    // 同じOrg IDがSandbox一覧にも存在するかを独立して確認する。
    const listedAsSandbox = sandboxes.some((sandbox) => sandbox.orgId === org.orgId);

    // CLI応答内の2つの分類が食い違う場合は安全側で停止する。
    if (org.isSandbox !== listedAsSandbox) {
        throw new Error('対象組織のSandbox情報がSalesforce CLIの分類と一致しません。');
    }

    // Sandboxと確認できた時点でEdition判定を行わず分類を確定する。
    if (org.isSandbox) {
        return orgTypes.SANDBOX;
    }

    // 非Sandboxの本番相当判定にはEdition情報を必須にする。
    if (typeof org.orgEdition !== 'string' || org.orgEdition.length === 0) {
        throw new Error('対象組織のEditionを確認できませんでした。');
    }

    // Developer Editionだけを独立分類し、残りを本番相当として扱う。
    return org.orgEdition === 'Developer Edition' ? orgTypes.DEVELOPER_EDITION : orgTypes.PRODUCTION;
}

// 認証済み組織一覧から、指定された1組織の表示情報と種別を取得する。
function getTargetOrgInfo({ repoRoot, runSfCommand, targetOrg }) {
    // 接続確認を発生させず、認証済み組織の保存情報だけを取得する。
    const result = parseSfJson(
        runSfCommand(['org', 'list', '--json', '--skip-connection-status'], repoRoot),
        '認証済み組織情報の取得'
    );

    // 安全判定に必要な3分類が揃わない応答は受け付けない。
    if (
        !result ||
        !Array.isArray(result.nonScratchOrgs) ||
        !Array.isArray(result.sandboxes) ||
        !Array.isArray(result.scratchOrgs)
    ) {
        throw new Error('認証済み組織情報に必要な分類がありません。');
    }

    // Scratch Orgは種別を確定し、非Scratch組織は後続判定の対象として集約する。
    const candidates = [
        ...result.scratchOrgs.map((org) => ({ org, type: orgTypes.SCRATCH })),
        ...result.nonScratchOrgs.map((org) => ({ org, type: null }))
    ].filter(({ org }) => matchesTargetOrg(org, targetOrg));

    // aliasまたはusernameの一致が1件だけの場合に対象を確定する。
    if (candidates.length !== 1) {
        throw new Error(`対象組織を一意に特定できませんでした: ${targetOrg}`);
    }

    // 一意に特定した組織本体と、既知ならScratch種別を取り出す。
    const [{ org, type: knownType }] = candidates;

    // 確認表示に必要なusernameを必須にする。
    if (typeof org.username !== 'string' || org.username.length === 0) {
        throw new Error('対象組織のユーザー名を確認できませんでした。');
    }

    // 接続先を識別できるinstance URLがない組織は操作対象にしない。
    if (typeof org.instanceUrl !== 'string' || org.instanceUrl.length === 0) {
        throw new Error('対象組織のURLを確認できませんでした。');
    }

    // Scratch以外の場合だけSandboxとEditionから種別を分類する。
    const type = knownType ?? classifyNonScratchOrg(org, result.sandboxes);

    return {
        alias: typeof org.alias === 'string' && org.alias.length > 0 ? org.alias : '（未設定）',
        instanceUrl: org.instanceUrl,
        type,
        typeLabel: orgTypeLabels[type],
        username: org.username
    };
}

// 接続先の確認に必要な情報だけを表示し、認証情報の他項目は出力しない。
function printTargetOrgInfo(orgInfo, writeLine = console.log) {
    writeLine('接続組織を確認してください。');
    writeLine(`・エイリアス: ${orgInfo.alias}`);
    writeLine(`・ユーザー名: ${orgInfo.username}`);
    writeLine(`・URL: ${orgInfo.instanceUrl}`);
    writeLine(`・種別: ${orgInfo.typeLabel}`);
}

module.exports = {
    getDefaultTargetOrg,
    getTargetOrgInfo,
    orgTypes,
    printTargetOrgInfo
};
