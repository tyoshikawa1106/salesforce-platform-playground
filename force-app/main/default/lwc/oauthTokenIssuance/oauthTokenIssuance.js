import { LightningElement, wire } from 'lwc';
import { getFieldValue, getRecord } from 'lightning/uiRecordApi';
import CURRENT_USER_ID from '@salesforce/user/Id';
import USER_NAME from '@salesforce/schema/User.Name';
import USER_USERNAME from '@salesforce/schema/User.Username';
import getAuthorizationOrigin from '@salesforce/apex/OAuthTokenIssuanceController.getAuthorizationOrigin';
import exchangeCode from '@salesforce/apex/OAuthTokenIssuanceController.exchangeCode';
import {
    createAuthorizationProof,
    createAuthorizationUrl,
    formatExecutionUser,
    getTokenRows,
    readAuthorizationCallback
} from './oauthTokenIssuanceLogic';

export default class OauthTokenIssuance extends LightningElement {
    clientId = '';
    redirectUri = '';
    clientSecret = '';
    callbackUrl = '';
    error = '';
    copyFeedback;
    origin;
    proof;
    authorizationLink;
    attempt;
    code;
    result;
    preparing = false;
    exchanging = false;
    generation = 0;

    @wire(getRecord, { recordId: CURRENT_USER_ID, fields: [USER_NAME, USER_USERNAME] })
    currentUser;

    connectedCallback() {
        // Salesforce の認可先とこの画面で使用する PKCE を準備
        this.prepare();
    }

    disconnectedCallback() {
        // 離脱前に開始された非同期処理の結果を無効化
        this.generation += 1;
        // 離脱後も秘密が画面の状態に残らないよう破棄
        this.clearCallback();
        // 認可前の PKCE とリンクも離脱時に破棄
        this.proof = undefined;
        this.authorizationLink = undefined;
        // 送信前のシークレットを別の画面セッションに持ち越さない
        this.clientSecret = '';
        // 取得結果と通知を画面のメモリから除去
        this.clearResult();
        // 再接続時に前回の入力エラーを表示しない
        this.error = '';
        // 再接続時に新しい認可操作を開始できるよう解除
        this.exchanging = false;
    }

    get startDisabled() {
        // 準備中と発行処理中だけボタンを無効にする
        return this.preparing || this.exchanging;
    }

    get authorizeLabel() {
        // 準備が失敗した場合も同じボタンで再試行できるようにする
        return !this.preparing && !this.proof ? '認可を準備する' : '別タブで認可する';
    }

    get authorizationConfig() {
        // 画面の入力を認可要求と交換で共通の形式にそろえる
        return { clientId: this.clientId.trim(), redirectUri: this.redirectUri.trim() };
    }

    get authorizationHref() {
        // 描画とクリックで同じ認可リンクを使う
        return this.authorizationLink?.href;
    }

    updateAuthorizationLink() {
        // 入力または PKCE の変更時にだけリンクを作り直す
        this.authorizationLink = undefined;
        const config = this.authorizationConfig;
        // 入力と PKCE がそろったときだけブラウザに遷移先を渡す
        if (!this.proof || !config.clientId || !config.redirectUri) {
            return;
        }
        try {
            // 登録済みの戻り先として扱える入力からリンクを組み立てる
            const href = createAuthorizationUrl(this.origin, config, this.proof);
            // 表示するリンクに対応する設定と PKCE を保持
            this.authorizationLink = { href, ...config, ...this.proof };
        } catch {
            // 無効な URL にはリンクを出さず、クリック時に案内する
        }
    }

    get exchangeDisabled() {
        // 今回の認可コードが確認済みの場合に限り交換を許可
        return !this.code || this.exchanging;
    }

    get configDisabled() {
        // 送信済みリクエストの処理中は設定を固定
        return this.exchanging;
    }

    get callbackDisabled() {
        // 認可を開始してから戻り先 URL の貼り付けを受け付ける
        return !this.attempt || this.exchanging;
    }

    get codeReady() {
        // 入力欄にコードの文字列を表示せず取得結果を伝える
        return Boolean(this.code);
    }

    get tokenRows() {
        // 結果画面のトークン項目を組み立てる
        return this.result ? getTokenRows(this.result, this.copyFeedback) : [];
    }

    get executionUserLabel() {
        // 表示用の氏名と Salesforce のログインユーザー名を取得
        const name = getFieldValue(this.currentUser?.data, USER_NAME);
        // レコード ID はユーザー情報の取得にだけ使用
        const username = getFieldValue(this.currentUser?.data, USER_USERNAME);
        // 発行前にログイン中のユーザーを確認できる表示へ整形
        return formatExecutionUser(name, username, this.currentUser);
    }

    get apiEndpointLabel() {
        // 発行前は認可先の組織、発行後は Salesforce が返した接続先を表示
        return this.result?.instanceUrl || this.origin || (this.preparing ? '確認中' : '確認できませんでした');
    }

    async prepare() {
        // 準備と離脱・再接続の順序を識別
        const generation = ++this.generation;
        // 安全な認可リンクを生成できるまで開始操作を止める
        this.preparing = true;
        // 片方だけが失敗しても、組織情報の取得結果は利用する
        const [origin, proof] = await Promise.allSettled([
            this.origin || getAuthorizationOrigin(),
            createAuthorizationProof(window.crypto)
        ]);
        // 古い準備処理では結果や操作ロックを更新しない
        if (generation !== this.generation) {
            return;
        }
        if (origin.status === 'fulfilled') {
            // PKCE の再試行でも取得済みの組織情報を再利用
            this.origin = origin.value;
        }
        if (origin.status === 'fulfilled' && proof.status === 'fulfilled') {
            // 次の認可に使う PKCE をリンクに反映
            this.proof = proof.value;
        } else if (!this.attempt && !this.exchanging) {
            // 進行中の認可がない場合に準備のやり直しを案内
            this.error = '認可の準備ができませんでした。利用権限を確認し、もう一度準備してください。';
        }
        // ブラウザが前の認可リンクを開いたあと、次のリンクへ差し替える
        this.updateAuthorizationLink();
        this.preparing = false;
    }

    clearCallback() {
        // PKCE 検証値とコールバックを取引ごとに廃棄
        this.attempt = undefined;
        // 以前のコードで発行できないようにする
        this.code = undefined;
        // 認可応答の URL を残さない
        this.callbackUrl = '';
    }

    clearResult() {
        // 前回のトークンを表示から削除
        this.result = undefined;
        // 前の結果のコピー状態を取り除く
        this.copyFeedback = undefined;
    }

    handleConfigChange(event) {
        // 認可前に入力した設定を保持
        const { name, value } = event.target;
        const authorizationConfigChanged = name !== 'clientSecret' && this[name] !== value;
        // アプリの鍵や戻り先を変更したら、以前の認可と発行結果を破棄
        if ((this.attempt || this.result) && authorizationConfigChanged) {
            // 変更後は同じボタンから新しい認可を開始できる
            this.clearCallback();
            // 変更前の設定で発行したトークンとコピー通知を消す
            this.clearResult();
            // 取り消した認可に関する案内を消す
            this.error = '';
        }
        // 設定フォームのフィールドを更新
        this[name] = value;
        // 秘密の変更では認可リンクを作り直さない
        if (authorizationConfigChanged) {
            this.updateAuthorizationLink();
        }
    }

    handleAuthorize(event) {
        // 準備中や送信済みの発行処理との重複を防止
        if (this.startDisabled) {
            // 処理の完了を待つ
            event.preventDefault();
            return;
        }
        // 初期準備が失敗した場合は、同じボタンで準備をやり直す
        if (!this.proof) {
            // リンクが残っていても準備中の値では開かない
            event.preventDefault();
            // 次の試行に前回の準備エラーを持ち越さない
            this.error = '';
            // 別タブを同期的に開けるよう、先に PKCE を準備
            this.prepare();
            // 準備後のクリックで認可を開始
            return;
        }
        // 必須項目に不足がある場合は対象欄に理由を表示
        const inputs = [...this.template.querySelectorAll('lightning-input[data-config]')];
        // 入力値を取得済みの認可設定として正規化
        const config = this.authorizationConfig;
        // すべての項目を一度検証してから開始可否を判断
        const valid = inputs.map((input) => input.reportValidity()).every(Boolean);
        // 空白のみの入力でも認可を送らない
        if (!valid || !config.clientId || !config.redirectUri) {
            // 必須値を確認するよう案内
            this.error = 'コンシューマー鍵とコールバック URL を入力してください。';
            // 認可操作を開始しない
            event.preventDefault();
            return;
        }
        // URL が無効か、編集直後で画面のリンクが古い場合は遷移を止める
        const link = this.authorizationLink;
        if (!link || event.currentTarget.getAttribute('href') !== link.href) {
            event.preventDefault();
            this.error = '認可を開始できませんでした。登録済みのコールバック URL を確認してください。';
            return;
        }
        // ブラウザのリンク操作で別タブを開き、今回の認可に対応する URL を待つ
        this.clearCallback();
        this.attempt = link;
        // 同じ PKCE と state を次の認可で再利用しない
        this.proof = undefined;
        this.error = '';
        this.prepare();
    }

    handleAuxiliaryAuthorize(event) {
        // 中ボタンで開く場合も、そのタブに対応する認可を開始
        if (event.button === 1) {
            this.handleAuthorize(event);
        }
    }

    handleCallbackChange(event) {
        // 現在の取引が終了した後に届いた入力イベントを無視
        if (this.callbackDisabled) {
            // 別の認可操作に古い URL を持ち越さない
            return;
        }
        // 入力中の URL を画面のメモリ内だけに保持
        this.callbackUrl = event.target.value;
        // 入力変更時は以前のコードで交換できないようにする
        this.code = undefined;
        // 貼り付けをやり直すと前回の案内を消す
        this.error = '';
        // クリアされた入力をエラーとして表示しない
        if (!this.callbackUrl.trim()) {
            // 次の貼り付けを待つ
            return;
        }
        try {
            // 登録先と今回の state が一致する認可コードを抽出
            this.code = readAuthorizationCallback(this.callbackUrl, this.attempt.redirectUri, this.attempt.state);
            // 新しい認可を確認できた時点で前回の結果を消す
            this.clearResult();
        } catch (error) {
            // 入力値をエラーメッセージへ差し込まない
            this.error =
                error instanceof TypeError
                    ? '認可後の URL 全体を貼り付けてください。'
                    : error.message;
        }
    }

    async handleExchange() {
        // 同じコードを二重送信しない
        if (this.exchangeDisabled) {
            // 処理中または未検証の操作を無視
            return;
        }
        // 離脱前に送った交換の応答を再接続後に反映しない
        const generation = this.generation;
        // 入力を消す前に交換用の値を確保
        const { clientId, redirectUri, verifier: codeVerifier } = this.attempt;
        // 送信に必要な値だけを Apex に渡す
        const request = { clientId, redirectUri, codeVerifier, code: this.code, clientSecret: this.clientSecret };
        // 一度送信した認可の秘密値を UI の状態に残さない
        this.clearCallback();
        // 送信したシークレットを画面の状態に残さない
        this.clientSecret = '';
        // 貼り付け操作に関する案内は交換時点で取り除く
        this.error = '';
        // 結果を受け取るまで次の操作をロック
        this.exchanging = true;
        try {
            // 送信したコードの交換結果を受け取る
            const result = await exchangeCode({ authorization: request });
            // 古い画面操作が新しい表示に影響しないよう中止
            if (generation !== this.generation) {
                // 現在の画面は交換結果を使用しない
                return;
            }
            // アクセストークンを取得できたときだけ結果を表示
            if (result?.accessToken) {
                // 応答にあるトークンと関連情報を表示
                this.result = result;
            } else {
                // Apex で安全な文言に変換済みの理由を表示
                this.error = result?.errorMessage || 'トークンを取得できませんでした。もう一度認可してください。';
            }
        } catch {
            // 離脱前の操作の失敗を表示しない
            if (generation === this.generation) {
                // ログや原文のエラーに含まれる認証情報を表示しない
                this.error = 'トークンを取得できませんでした。もう一度認可してください。';
            }
        } finally {
            // 現在の操作のロックだけを解除
            if (generation === this.generation) {
                // 結果の確認または新しい認可へ進めるようにする
                this.exchanging = false;
            }
        }
    }

    async handleCopy(event) {
        // コピーしようとした結果を操作の単位として保持
        const result = this.result;
        // 実際に表示したフィールドだけをコピー対象とする
        const row = this.tokenRows.find(({ name }) => name === event.currentTarget.dataset.token);
        // 未返却のトークンにはコピー操作を行わない
        if (!row?.value) {
            // クリップボードを変更せず終了
            return;
        }
        // コピーの結果を、最後に押したボタンの横に表示
        const feedback = { name: row.name, message: '' };
        // 次のコピーやリセット時に古い応答を判別できるよう保持
        this.copyFeedback = feedback;
        try {
            // 利用者が選んだトークンだけをクリップボードへ書く
            await navigator.clipboard.writeText(row.value);
            // リセット後に前のコピー結果を表示しない
            if (this.result === result && this.copyFeedback === feedback) {
                // トークン自体を通知文に含めない
                this.copyFeedback = { ...feedback, message: row.label + 'をコピーしました。' };
            }
        } catch {
            // 現在表示中の結果にだけ手動コピーの案内を追加
            if (this.result === result && this.copyFeedback === feedback) {
                // ブラウザがクリップボードへの書き込みを拒否してもコピーできるようにする
                this.copyFeedback = { ...feedback, message: 'コピーできませんでした。項目の値を選択してコピーしてください。' };
            }
        }
    }
}