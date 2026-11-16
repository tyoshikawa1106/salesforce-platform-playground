// 用途: Scratch Org内のECA資格情報を、同じ組織内の対応する認証プロバイダーへ登録する。

const { spawnSync } = require('node:child_process');
const { buildSfCommand, runSfWithOutput } = require('../../common/run-command');
const { sourceApiVersion } = require('../../../sfdx-project.json');
const { repoRoot } = require('./context');

const apiRoot = `/services/data/v${sourceApiVersion}`;

// 認証済みCLIで同一組織へREST要求を送り、資格情報は標準入出力のパイプだけで渡す。
function requestScratchRest(username, resource, method, body, spawnCommand = spawnSync) {
    // 更新内容はプロセス引数やファイルに書き出さず、CLIの標準入力から渡す。
    const args = ['api', 'request', 'rest', apiRoot + resource, '--target-org', username, '--method', method, '--json'];
    // 更新時だけ、引数ではなく標準入力のJSONを読み込ませる。
    if (body !== undefined) args.push('--body', '-', '--header', 'Content-Type:application/json');
    // 既存の起動処理でmacOS・Windows両方の引数規則を適用する。
    const command = buildSfCommand(args);
    // レスポンスを画面に表示せず、CLIによるログ出力も抑止する。
    const result = spawnCommand(command.command, command.args, {
        cwd: repoRoot,
        encoding: 'utf8',
        input: body === undefined ? undefined : JSON.stringify(body),
        env: { ...process.env, SF_DISABLE_LOG_FILE: 'true', SF_LOG_LEVEL: 'fatal' },
        timeout: 120000
    });
    // エラー情報には資格情報を含む可能性があるため、呼び出し元には固定文言を返す。
    try {
        // CLIの終了状態とHTTPの成功状態を別々に照合する。
        const response = JSON.parse(result.stdout);
        // 非0終了やAPIエラーを、登録成功として扱わない。
        if (
            result.status === 0 &&
            response.status === 0 &&
            response.result?.statusCode >= 200 &&
            response.result.statusCode < 300
        ) {
            // 呼び出し元へは解析済みの応答だけを返す。
            return response.result.body;
        }
    } catch {
        // 生の応答やパースエラーは公開しない。
    }
    // URLや応答の秘密情報を例外文へ含めない。
    throw new Error('Scratch OrgのOAuth資格情報APIが失敗しました。');
}

// 作成済みのローカルECAとプロバイダーを照合してから、資格情報を登録する。
function registerProviderCredentials(
    username,
    providerApps,
    runSfQuery = runSfWithOutput,
    request = requestScratchRest
) {
    // プロバイダー名とアプリ名が異なる場合も、明示した対応を使う。
    if (!providerApps || typeof providerApps !== 'object' || Array.isArray(providerApps)) {
        // 対応が不明なまま資格情報を取得しない。
        throw new Error('認証プロバイダーとECAの対応が不正です。');
    }
    // 同じECAを参照するプロバイダーが複数あっても、一つのアプリとして照合する。
    const entries = Object.entries(providerApps);
    // 同一アプリの鍵を繰り返し取得しないよう重複を除く。
    const appNames = [...new Set(Object.values(providerApps))];
    // プロバイダーがなければREST APIを呼び出さない。
    if (entries.length === 0) return;
    // SOQLとRESTパスに使えるAPI名だけを許可する。
    if (entries.flat().some((name) => typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) {
        // 不正な名前を外部要求へ送信しない。
        throw new Error('認証プロバイダーまたはECAのAPI名が不正です。');
    }
    // Git管理の対象名だけを使用し、組織側のアプリ名とIDを取得する。
    const names = appNames.map((name) => `'${name}'`).join(', ');
    // 同じScratch Orgで作成されたLocalアプリだけを取得する。
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
    // CLIのJSONエラーから生の応答が例外文へ混入しないようにする。
    let response;
    try {
        // 対象アプリの照合に必要なレコードを解析する。
        response = JSON.parse(query.stdout);
    } catch {
        // JSON解析の失敗に応答断片を含めない。
        throw new Error('Scratch OrgのローカルECAを照合できません。');
    }
    // 応答件数と各アプリの一意性を後続で確認する。
    const records = response.result?.records;
    // 未完了のページや不完全な応答からアプリを選ばない。
    if (
        response.status !== 0 ||
        !Array.isArray(records) ||
        records.length !== appNames.length ||
        response.result.done === false
    ) {
        throw new Error('Scratch OrgのローカルECAを照合できません。');
    }

    // すべての鍵を確認してから書き込みを開始する。
    const appCredentials = new Map(
        appNames.map((name) => {
            // 対応設定で指定したローカルECAだけを照合する。
            const matches = records.filter((row) => row?.DeveloperName === name);
            // APIの資源指定に使用するIDを取得する。
            const appId = matches[0]?.Id;
            // 一意性とECAのID形式を確認してから要求する。
            if (
                matches.length !== 1 ||
                typeof appId !== 'string' ||
                !/^0xI[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(appId)
            ) {
                // 対象不明のアプリへ資格情報要求を送らない。
                throw new Error(`${name}のローカルECAを一意に確認できません。`);
            }
            // 唯一のOAuthコンシューマーから現行の資格情報だけを取得する。
            const resource = `/apps/oauth/credentials/${appId}`;
            // 現在関連付いているコンシューマー一覧を取得する。
            const { consumers } = request(username, resource, 'GET') ?? {};
            // 件数を検証するまでは先頭の値を採用しない。
            const consumer = consumers?.[0]?.id;
            // 複数コンシューマーから推測して鍵を選ばない。
            if (
                !Array.isArray(consumers) ||
                consumers.length !== 1 ||
                typeof consumer !== 'string' ||
                !/^888[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(consumer)
            ) {
                // 対象が一意でない場合は書き込み前に止める。
                throw new Error(`${name}のOAuthコンシューマーを一意に確認できません。`);
            }
            // ステージされた鍵や、取得元の組織の資格情報は使わない。
            const { key, secret } = request(username, `${resource}/${consumer}?part=keyandsecret`, 'GET') ?? {};
            // 空や欠落した資格情報で登録済みの値を上書きしない。
            if (typeof key !== 'string' || !key.trim() || typeof secret !== 'string' || !secret.trim()) {
                // 取得できなかったアプリ名だけを報告する。
                throw new Error(`${name}のOAuth資格情報を確認できません。`);
            }
            // 資格情報は次の書き込みまでメモリ上だけで保持する。
            return [name, { key, secret }];
        })
    );

    // 全プロバイダーの登録状態を確認してから、作成または更新を開始する。
    const registrations = entries.map(([name, app]) => {
        // 明示的に対応付けたプロバイダーだけを登録先にする。
        const resource = `/named-credentials/external-auth-identity-provider-credentials/${name}`;
        // 新規登録と更新の使い分けに現在の状態を使用する。
        const existing = request(username, resource, 'GET');
        // 登録状態が不明な場合にPOSTへ推測で切り替えない。
        if (!Array.isArray(existing?.credentials)) {
            // 書き込み開始前に照合失敗を報告する。
            throw new Error(`${name}の資格情報の登録状態を確認できません。`);
        }
        // 検証済みの登録先と同じ組織の資格情報を組み合わせる。
        return { resource, method: existing.credentials.length === 0 ? 'POST' : 'PUT', ...appCredentials.get(app) };
    });
    // 登録途中の失敗はそのまま上位へ伝え、次の実行で状態を再確認する。
    for (const { resource, method, key, secret } of registrations) {
        // 資格情報は同じ組織内の、関連付け済みの認証プロバイダーだけへ送る。
        request(username, resource, method, {
            credentials: [
                { credentialName: 'clientId', credentialValue: key },
                { credentialName: 'clientSecret', credentialValue: secret }
            ]
        });
    }
}

module.exports = { registerProviderCredentials, requestScratchRest };
