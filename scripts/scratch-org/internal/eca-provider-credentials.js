// 用途: Scratch Org内のECA資格情報を、同じ組織内の対応する認証プロバイダーへ登録する。

const { spawnSync } = require('node:child_process');
const { buildSfCommand, runSfWithOutput } = require('../../common/run-command');
const { sourceApiVersion } = require('../../../sfdx-project.json');
const { repoRoot } = require('./context');

const apiRoot = `/services/data/v${sourceApiVersion}`;

// 認証済みCLIで同一組織へREST要求を送り、資格情報は標準入出力のパイプだけで渡す。
function requestScratchRest(username, resource, method, body) {
    // 更新内容はプロセス引数やファイルに書き出さず、CLIの標準入力から渡す。
    const args = ['api', 'request', 'rest', apiRoot + resource, '--target-org', username, '--method', method, '--json'];
    if (body !== undefined) args.push('--body', '-', '--header', 'Content-Type:application/json');
    // 既存の起動処理でmacOS・Windows両方の引数規則を適用する。
    const command = buildSfCommand(args);
    // レスポンスを画面に表示せず、CLIによるログ出力も抑止する。
    const result = spawnSync(command.command, command.args, {
        cwd: repoRoot,
        encoding: 'utf8',
        input: body === undefined ? undefined : JSON.stringify(body),
        env: { ...process.env, SF_DISABLE_LOG_FILE: 'true', SF_LOG_LEVEL: 'fatal' },
        timeout: 120000
    });
    // エラー情報には資格情報を含む可能性があるため、呼び出し元には固定文言を返す。
    try {
        const response = JSON.parse(result.stdout);
        if (
            result.status === 0 &&
            response.status === 0 &&
            response.result?.statusCode >= 200 &&
            response.result.statusCode < 300
        ) {
            return response.result.body;
        }
    } catch {
        // 生の応答やパースエラーは公開しない。
    }
    throw new Error('Scratch OrgのOAuth資格情報APIが失敗しました。');
}

// 作成済みのローカルECAとプロバイダーを照合してから、資格情報を登録する。
function registerProviderCredentials(
    username,
    providerNames,
    runSfQuery = runSfWithOutput,
    request = requestScratchRest
) {
    // メタデータ由来のAPI名を検証してからSOQLに渡す。
    if (providerNames.length === 0) return;
    if (providerNames.some((name) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) {
        throw new Error('認証プロバイダーのAPI名が不正です。');
    }
    // Git管理の対象名だけを使用し、組織側のアプリ名とIDを取得する。
    const names = providerNames.map((name) => `'${name}'`).join(', ');
    const query = runSfQuery(
        [
            'data',
            'query',
            '--target-org',
            username,
            '--query',
            `SELECT Id, DeveloperName FROM ExternalClientApplication WHERE DistributionState = 'Local' AND DeveloperName IN (${names})`,
            '--json'
        ],
        repoRoot
    );
    // 想定するローカルアプリを一意に確認できない場合は登録前に停止する。
    if (query.status !== 0) throw new Error('Scratch OrgのローカルECAを照合できません。');
    const response = JSON.parse(query.stdout);
    const records = response.result?.records;
    if (response.status !== 0 || !Array.isArray(records) || records.length !== providerNames.length) {
        throw new Error('Scratch OrgのローカルECAを照合できません。');
    }

    // すべての鍵を確認してから書き込みを開始する。
    const registrations = providerNames.map((name) => {
        // 同じAPI名のローカルECAだけを対応するプロバイダーに割り当てる。
        const matches = records.filter((row) => row?.DeveloperName === name);
        const appId = matches[0]?.Id;
        if (
            matches.length !== 1 ||
            typeof appId !== 'string' ||
            !/^0xI[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(appId)
        ) {
            throw new Error(`${name}のローカルECAを一意に確認できません。`);
        }
        // 唯一のOAuthコンシューマーから現行の資格情報だけを取得する。
        const resource = `/apps/oauth/credentials/${appId}`;
        const { consumers } = request(username, resource, 'GET') ?? {};
        const consumer = consumers?.[0]?.id;
        if (
            !Array.isArray(consumers) ||
            consumers.length !== 1 ||
            typeof consumer !== 'string' ||
            !/^888[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(consumer)
        ) {
            throw new Error(`${name}のOAuthコンシューマーを一意に確認できません。`);
        }
        // ステージされた鍵や、取得元の組織の資格情報は使わない。
        const { key, secret } = request(username, `${resource}/${consumer}?part=keyandsecret`, 'GET') ?? {};
        if (typeof key !== 'string' || !key.trim() || typeof secret !== 'string' || !secret.trim()) {
            throw new Error(`${name}のOAuth資格情報を確認できません。`);
        }
        // 資格情報は次の書き込みまでメモリ上だけで保持する。
        return { name, key, secret };
    });

    // PUTで同じ値を再設定できるようにし、途中失敗から同じ手順で再開できるようにする。
    for (const { name, key, secret } of registrations) {
        // 資格情報は同じ組織内の、関連付け済みの認証プロバイダーだけへ送る。
        request(username, `/named-credentials/external-auth-identity-provider-credentials/${name}`, 'PUT', {
            credentials: [
                { credentialName: 'clientId', credentialValue: key },
                { credentialName: 'clientSecret', credentialValue: secret }
            ]
        });
    }
}

module.exports = { registerProviderCredentials };
