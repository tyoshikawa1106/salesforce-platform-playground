// 実行方法: 組織へ変更を加えるNodeスクリプトから読み込む。
// 用途: Salesforce CLIの認証済み組織一覧から対象組織を特定し、安全確認用の情報を返す。

const orgTypes = Object.freeze({
    DEVELOPER_EDITION: 'developer-edition',
    PRODUCTION: 'production',
    SANDBOX: 'sandbox',
    SCRATCH: 'scratch'
});

const orgTypeLabels = Object.freeze({
    [orgTypes.DEVELOPER_EDITION]: 'Developer Edition',
    [orgTypes.PRODUCTION]: '本番環境',
    [orgTypes.SANDBOX]: 'Sandbox',
    [orgTypes.SCRATCH]: 'Scratch Org'
});

// Salesforce CLIの実行結果を、安全判定に使用できるJSONへ変換する。
function parseSfJson(result, operation) {
    if (result.error) {
        throw new Error(`${operation}を開始できませんでした: ${result.error.message}`);
    }

    if (result.status !== 0) {
        throw new Error(`${operation}に失敗しました。`);
    }

    let parsed;

    try {
        parsed = JSON.parse(result.stdout || '');
    } catch (error) {
        throw new Error(`${operation}のJSONを解析できませんでした: ${error.message}`);
    }

    if (parsed.status !== 0) {
        throw new Error(`${operation}でSalesforce CLIがエラーを返しました。`);
    }

    return parsed.result;
}

// Default Target Orgとして設定されたaliasまたはusernameを取得する。
function getDefaultTargetOrg({ repoRoot, runSfCommand }) {
    const result = parseSfJson(
        runSfCommand(['config', 'get', 'target-org', '--json'], repoRoot),
        'Default Target Orgの取得'
    );

    if (!Array.isArray(result) || result.length !== 1) {
        throw new Error('Default Target Orgを一意に取得できませんでした。');
    }

    const [targetOrg] = result;

    if (targetOrg.success !== true || typeof targetOrg.value !== 'string' || targetOrg.value.length === 0) {
        throw new Error('Default Target Orgが設定されていません。');
    }

    return targetOrg.value;
}

// aliasまたはusernameが実行対象と一致する組織だけを残す。
function matchesTargetOrg(org, targetOrg) {
    return org.alias === targetOrg || org.username === targetOrg;
}

// 非Scratch組織をSandbox、Developer Edition、本番相当へ分類する。
function classifyNonScratchOrg(org, sandboxes) {
    if (typeof org.orgId !== 'string' || org.orgId.length === 0) {
        throw new Error('対象組織のOrg IDを確認できませんでした。');
    }

    if (typeof org.isSandbox !== 'boolean') {
        throw new Error('対象組織のSandbox情報を確認できませんでした。');
    }

    const listedAsSandbox = sandboxes.some((sandbox) => sandbox.orgId === org.orgId);

    if (org.isSandbox !== listedAsSandbox) {
        throw new Error('対象組織のSandbox情報がSalesforce CLIの分類と一致しません。');
    }

    if (org.isSandbox) {
        return orgTypes.SANDBOX;
    }

    if (typeof org.orgEdition !== 'string' || org.orgEdition.length === 0) {
        throw new Error('対象組織のEditionを確認できませんでした。');
    }

    return org.orgEdition === 'Developer Edition' ? orgTypes.DEVELOPER_EDITION : orgTypes.PRODUCTION;
}

// 認証済み組織一覧から、指定された1組織の表示情報と種別を取得する。
function getTargetOrgInfo({ repoRoot, runSfCommand, targetOrg }) {
    const result = parseSfJson(
        runSfCommand(['org', 'list', '--json', '--skip-connection-status'], repoRoot),
        '認証済み組織情報の取得'
    );

    if (
        !result ||
        !Array.isArray(result.nonScratchOrgs) ||
        !Array.isArray(result.sandboxes) ||
        !Array.isArray(result.scratchOrgs)
    ) {
        throw new Error('認証済み組織情報に必要な分類がありません。');
    }

    const candidates = [
        ...result.scratchOrgs.map((org) => ({ org, type: orgTypes.SCRATCH })),
        ...result.nonScratchOrgs.map((org) => ({ org, type: null }))
    ].filter(({ org }) => matchesTargetOrg(org, targetOrg));

    if (candidates.length !== 1) {
        throw new Error(`対象組織を一意に特定できませんでした: ${targetOrg}`);
    }

    const [{ org, type: knownType }] = candidates;

    if (typeof org.username !== 'string' || org.username.length === 0) {
        throw new Error('対象組織のユーザー名を確認できませんでした。');
    }

    if (typeof org.instanceUrl !== 'string' || org.instanceUrl.length === 0) {
        throw new Error('対象組織のURLを確認できませんでした。');
    }

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

// yまたはYだけを明示的な承認として扱う。
function isApproved(answer) {
    return answer === 'y' || answer === 'Y';
}

module.exports = {
    getDefaultTargetOrg,
    getTargetOrgInfo,
    isApproved,
    orgTypes,
    printTargetOrgInfo
};
