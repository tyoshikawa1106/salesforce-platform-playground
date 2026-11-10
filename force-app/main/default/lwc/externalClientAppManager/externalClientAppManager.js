import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { LightningElement } from 'lwc';
import LightningConfirm from 'lightning/confirm';
import ExternalClientAppCredentialModal from 'c/externalClientAppCredentialModal';
import getAuthentication from '@salesforce/apex/ExternalClientAppManagerController.getAuthentication';
import revokeAuthentication from '@salesforce/apex/ExternalClientAppManagerController.revokeAuthentication';
import execute from '@salesforce/apex/ExternalClientAppManagerController.execute';
import {
    applicationOptions,
    errorMessage,
    stageRows,
    stageOperation,
    automationStage,
    normalizedApplicationId
} from './externalClientAppManagerLogic';

// 本人の認証と選択中アプリに対する操作順序を管理する
export default class ExternalClientAppManager extends LightningElement {
    // 認証確認が終わるまで操作領域を隠す
    authenticationStatus = 'CHECKING';
    // Salesforceが発行した標準認証開始先だけを使用する
    authenticationUrl = '';
    // サーバーで所属確認したアプリ候補を保持する
    applications = [];
    // 候補取得時だけ表示選択肢を生成する
    appOptions = applicationOptions();
    // 更新後も利用者の選択を維持する
    appId = '';
    // 確認ダイアログと通信を含めて並行操作を防ぐ
    busy = false;
    // 更新・認証の公開エラーを表示する
    error = '';
    // APIから取得した公開属性だけを保持する
    stages = [];
    // 取得失敗を空一覧と区別する
    stagesLoaded = false;
    // 画面を離れる前に開始した非同期処理を復帰後へ持ち越さない
    operationVersion = 0;

    get authenticationRequired() {
        // 明示的な未認証だけを認証操作へ案内する
        return this.authenticationStatus === 'REQUIRED' && !!this.authenticationUrl;
    }

    get authenticationReady() {
        // 本人確認済みの接続だけに操作を公開する
        return this.authenticationStatus === 'AUTHENTICATED';
    }

    connectedCallback() {
        // 初期表示で認証状態から候補取得へ進む
        this.loadApplications();
    }

    disconnectedCallback() {
        // 送信済み要求は取り消さず、応答後の後続操作だけを無効化する
        this.operationVersion += 1;
        // 離脱前の一覧から削除や状態判断を再開させない
        this.stagesLoaded = false;
        // 古い公開属性も復帰時へ持ち越さない
        this.stages = [];
    }

    async loadApplications() {
        // この画面接続で開始した処理だけを継続する
        const operationVersion = this.operationVersion;
        // 再接続時も本人確認が終わるまで操作画面を隠す
        this.authenticationStatus = 'CHECKING';
        // 前回の取得結果を最新状態として表示しない
        this.stagesLoaded = false;
        // 今回の取得結果だけを案内する
        this.error = '';
        // 認証状態と一覧を取得する間は操作を固定する
        this.busy = true;
        try {
            // 未認証の接続へアプリ一覧を要求しない
            const authentication = await getAuthentication();
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // サーバーで判定した状態だけを使用する
            this.authenticationStatus = authentication.status;
            // 再認証時の古いURLを持ち越さない
            this.authenticationUrl = authentication.url || '';
            // 接続設定の不備は認証ボタンで解決すると推測しない
            if (!this.authenticationReady) {
                // 未認証と確認不能で案内を分ける
                this.error = this.authenticationRequired
                    ? ''
                    : '認証状態を確認できません。接続設定と権限を確認し、画面を再読み込みしてください。';
                return;
            }
            // 資格情報を含まない候補だけを取得する
            const response = await execute({ input: { action: 'list' } });
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // サーバーで認証元とパッケージアプリを除外した候補を反映する
            this.applications = response.applications || [];
            // 描画のたびに候補配列を再生成しない
            this.appOptions = applicationOptions(this.applications);
            // 選択済みの対象がある場合は復帰時の最新候補と照合する
            if (this.appId) {
                // 削除済みや対象外になったアプリの古い選択を引き継がない
                const app = this.applications.find((item) => item.id === this.appId);
                // 候補から外れた対象にはステージAPIを送信しない
                if (!app) {
                    // 有効な候補を利用者が選び直せる状態へ戻す
                    this.appId = '';
                    return;
                }
                // 送信済みの変更要求が離脱中に完了した可能性をAPIで確認する
                const current = await execute({ input: stageOperation('stages', app, undefined, this.appId).input });
                // 再取得中の再離脱でも古い応答を反映しない
                if (!this.isConnected || operationVersion !== this.operationVersion) return;
                // 取得済みの公開属性だけで一覧を置き換える
                this.stages = stageRows(current.stages);
                // 復帰後の確認が完了した一覧だけを表示する
                this.stagesLoaded = true;
            }
        } catch (error) {
            // 古い要求の失敗を別の画面接続へ反映しない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 内部例外を表示しない
            this.error = errorMessage(error);
        } finally {
            // 初期取得が完了してから選択を許可する
            if (this.isConnected && operationVersion === this.operationVersion) this.busy = false;
        }
    }

    handleAuthenticationStart(event) {
        // 標準認証URLの準備が終わった本人操作だけを通す
        if (this.busy || !this.authenticationRequired) {
            // 未準備の画面遷移を止める
            event.preventDefault();
        }
    }

    async handleAuthenticationRevoke() {
        // この画面接続で開始した処理だけを継続する
        const operationVersion = this.operationVersion;
        // 更新中・確認中の認証解除を拒否する
        if (this.busy || !this.authenticationReady) {
            return;
        }
        // 確認中も別の操作を受け付けない
        this.busy = true;
        // キャンセルと解除要求後の失敗を区別する
        let submitted = false;
        try {
            // 本人の管理用認証だけが対象であることを確認する
            const confirmed = await LightningConfirm.open({
                label: '認証解除',
                message: '認証を解除しますか？',
                theme: 'warning'
            });
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 中止時は現在の画面を維持する
            if (!confirmed) {
                return;
            }
            // 応答消失時に認証済みのまま操作させない
            submitted = true;
            // 解除処理へ進む時点で入力領域を隠す
            this.authenticationStatus = 'CHECKING';
            // 古い認証URLを無効にする
            this.authenticationUrl = '';
            // 本人のPer User資格情報だけを解除する
            await revokeAuthentication();
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 解除前の選択と確認結果を破棄する
            this.appId = '';
            // 候補は再認証後に取得し直す
            this.applications = [];
            // 再認証後へ選択肢を持ち越さない
            this.appOptions = applicationOptions();
            // 解除成功の通知は表示しない
            this.error = '';
            // 標準認証状態から次の認証URLを準備する
            await this.loadApplications();
        } catch {
            // 古い要求の失敗を別の画面接続へ反映しない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 解除要求後の失敗だけを確認不能へ遷移させる
            if (submitted) {
                // 認証済みと推測して操作を再開しない
                this.authenticationStatus = 'UNAVAILABLE';
            }
            // 秘密を含まない固定案内を表示する
            this.error = '認証の解除結果を確認できません。画面を再読み込みして確認してください。';
        } finally {
            // 中止・失敗時も操作中の表示を終える
            if (this.isConnected && operationVersion === this.operationVersion) this.busy = false;
        }
    }

    async handleAppChange(event) {
        // 通信中にプログラムから発火した選択変更も拒否する
        if (this.busy) {
            return;
        }
        // 利用者が選択したアプリへ対象を変更する
        this.appId = event.detail.value;
        // 前の対象のエラーを持ち越さない
        this.error = '';
        // 前の対象の資格情報を表示しない
        this.stages = [];
        // 新しい対象の取得前に空一覧と判断しない
        this.stagesLoaded = false;
        // 再訪時もサーバーに残っている資格情報を取得する
        if (this.appId) await this.handleStagesRefresh();
    }

    get hasStages() {
        // 空状態の案内と取得済み行を切り替える
        return this.stages.length > 0;
    }

    async handleStagesRefresh() {
        // この画面接続で開始した処理だけを継続する
        const operationVersion = this.operationVersion;
        // 変更要求と一覧取得の並行実行を防ぐ
        if (this.busy || !this.appId || !this.authenticationReady) return;
        // 取得が終わるまで対象を固定する
        this.busy = true;
        // 前回の状態を確定情報として表示しない
        this.stagesLoaded = false;
        try {
            // 所属確認済みの対象だけを問い合わせる
            const app = this.applications.find((item) => item.id === this.appId);
            // 確認IDの編集内容によらず選択した対象の公開属性を取得する
            const response = await execute({
                input: stageOperation('stages', app, undefined, this.appId).input
            });
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 秘密値を保持せずAPIの現在状態を反映する
            this.stages = stageRows(response.stages);
            // 正常取得した空一覧だけを空状態として表示する
            this.stagesLoaded = true;
            // 再取得成功で過去のエラーを消す
            this.error = '';
        } catch (error) {
            // 古い要求の失敗を別の画面接続へ反映しない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 取得できなかった一覧を空と推測しない
            this.error = errorMessage(error);
        } finally {
            // 取得完了後に操作を再開する
            if (this.isConnected && operationVersion === this.operationVersion) this.busy = false;
        }
    }

    async handleStageDelete(event) {
        // この画面接続で開始した処理だけを継続する
        const operationVersion = this.operationVersion;
        // 二重削除と対象変更を拒否する
        if (this.busy || !this.authenticationReady || !this.stagesLoaded) return;
        // 本人が選択した表示中の行だけを削除対象とする
        const stage = this.stages.find((row) => row.id === event.currentTarget.dataset.id);
        // 不明状態の資格情報を削除しない
        if (!stage?.canDelete) return;
        // 確認から削除まで対象を固定する
        this.busy = true;
        try {
            // サーバーへ同じ対象・ID・状態を照合させる
            const app = this.applications.find((item) => item.id === this.appId);
            // 旧コンシューマ鍵と秘密と未適用資格情報を区別した確認文を組み立てる
            const operation = stageOperation('deleteStage', app, stage, this.appId);
            // 削除は本人が承認した場合だけ開始する
            const confirmed = await LightningConfirm.open({
                label: 'コンシューマ鍵と秘密の削除',
                message: operation.message,
                theme: 'warning'
            });
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // キャンセル時は削除APIを呼び出さない
            if (!confirmed) return;
            // 結果不明時に古い表示から再削除させない
            this.stagesLoaded = false;
            // 指定した一件だけを削除する
            const response = await execute({ input: operation.input });
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 変更前の拒否はサーバーの公開案内を維持する
            if (response.state === 'notStarted' && response.message) {
                this.stagesLoaded = false;
                this.error = response.message;
                return;
            }
            // サーバーで完了確認できた場合だけ一覧へ反映する
            if (response.state !== 'complete') throw new Error('削除未確認');
            // 削除後の最新状態を取得する
            const rows = stageRows(response.stages);
            // 対象が残る応答を成功として表示しない
            if (rows.some((row) => row.id === stage.id)) throw new Error('削除対象が残っています。');
            // 他の行を消さず最新一覧へ更新する
            this.stages = rows;
            // 正常応答の一覧だけを公開する
            this.stagesLoaded = true;
            // 成功後に過去のエラーを消す
            this.error = '';
            // 本人による削除の完了だけを通知する
            this.dispatchEvent(
                new ShowToastEvent({
                    title: '成功',
                    message: '指定したコンシューマ鍵と秘密を削除しました。',
                    variant: 'success'
                })
            );
        } catch {
            // 古い要求の失敗を別の画面接続へ反映しない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 自動再送せずAPIによる状態再取得へ案内する
            this.error = '削除の完了を確認できません。アプリを選択し直して現在の状態を確認してください。';
        } finally {
            // 本人による次の操作を受け付ける
            if (this.isConnected && operationVersion === this.operationVersion) this.busy = false;
        }
    }

    async handleAutomaticUpdate() {
        // この画面接続で開始した処理だけを継続する
        const operationVersion = this.operationVersion;
        // 確認・通信中の二重起動を拒否する
        if (this.busy || !this.appId || !this.authenticationReady) return;
        // 所属確認済みの候補から要求を組み立てる
        const app = this.applications.find((item) => item.id === this.appId);
        // 処理全体を通じて対象変更を禁止する
        this.busy = true;
        // 失敗した工程だけを公開案内に使用する
        let phase = 'ステージ確認';
        try {
            // 前回の失敗を今回の結果と混同しない
            this.error = '';
            // ポップアップを開く前にサーバーで対象と最新状態を照合する
            const initial = await execute({
                input: stageOperation('stages', app, undefined, app.id).input
            });
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 生の資格情報を保持せず公開属性だけを使う
            let rows = stageRows(initial.stages);
            // 旧コンシューマ鍵と秘密を次回実行時にも無断削除しない
            this.stages = rows;
            // 再実行でも最新の残存状態を表示する
            this.stagesLoaded = true;
            // 旧コンシューマ鍵と秘密や状態不明の行がある場合は変更前に手動整理を案内する
            if (rows.some((row) => row.state?.toLowerCase() !== 'active')) {
                // 旧コンシューマ鍵と秘密の意図しない置き換えを防ぐ
                this.error = '旧コンシューマ鍵と秘密が残っています。連携先の切り替えを確認し、一覧から手動で削除してから生成してください。';
                return;
            }
            // 入力検証をモーダル内で完了させる
            const confirmationId = await ExternalClientAppCredentialModal.open({
                size: 'small',
                applicationLabel: app.label,
                expectedId: normalizedApplicationId(app.id)
            });
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 入力の一致を確認して閉じた場合だけ操作を開始する
            if (!confirmationId) return;
            // 未適用だけを整理し、適用済みの旧コンシューマ鍵と秘密は保持する
            const pending = rows.filter((row) => row.state?.toLowerCase() === 'active');
            // 未適用がある場合だけ一意に特定して削除する
            if (pending.length) {
                // 複数の未適用が返った場合は変更せず停止する
                const row = automationStage(rows, undefined, 'active');
                // 削除失敗を生成失敗と区別する
                phase = '未適用資格情報の削除';
                // サーバーでIDと状態を再照合してから削除する
                const deleted = await execute({
                    input: stageOperation('deleteStage', app, row, confirmationId.trim()).input
                });
                // 離脱または再接続後は後続のAPI送信と画面更新を行わない
                if (!this.isConnected || operationVersion !== this.operationVersion) return;
                // 変更前の拒否はサーバーの公開案内を維持する
                if (deleted.state === 'notStarted' && deleted.message) {
                    this.stagesLoaded = false;
                    this.error = deleted.message;
                    return;
                }
                // 完了未確認なら新しい資格情報を生成しない
                if (deleted.state !== 'complete') throw new Error('削除未確認');
                // 削除後の最新一覧だけを画面へ反映する
                rows = stageRows(deleted.stages);
                // 対象が残っている場合も生成へ進まない
                if (rows.some((item) => item.id === row.id)) throw new Error('削除未確認');
                // 旧コンシューマ鍵と秘密を含む残存一覧を維持する
                this.stages = rows;
            }
            // 削除中に現れた旧コンシューマ鍵と秘密も残したまま生成しない
            if (rows.length) {
                // 状態変更後は本人が一覧を確認して整理する
                this.error = 'ステージに資格情報が残っています。一覧を確認し、手動で削除してから生成してください。';
                return;
            }
            // 生成に失敗した場合は適用へ進めない
            phase = '生成';
            // ステージが残っていないことをサーバー側でも再検証する
            const generated = await execute({
                input: stageOperation('generate', app, undefined, confirmationId.trim()).input
            });
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 変更前の拒否はサーバーの公開案内を維持する
            if (generated.state === 'notStarted' && generated.message) {
                this.stagesLoaded = false;
                this.error = generated.message;
                return;
            }
            // 事前拒否と完了未確認のどちらも後続を止める
            if (generated.state !== 'complete') throw new Error('生成未確認');
            // 秘密を含まない生成結果だけを表示へ反映する
            rows = stageRows(generated.stages);
            // 今回生成されたactiveの一件だけを適用対象にする
            const stage = automationStage(rows, undefined, 'active');
            // 未適用で停止した場合も再取得で確認できる状態にする
            this.stages = rows;
            // 適用の失敗を生成の失敗と区別する
            phase = '適用';
            // 今回生成した同じIDだけを適用する
            const applied = await execute({
                input: stageOperation('apply', app, stage, confirmationId.trim()).input
            });
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 変更前の拒否はサーバーの公開案内を維持する
            if (applied.state === 'notStarted' && applied.message) {
                this.stagesLoaded = false;
                this.error = applied.message;
                return;
            }
            // 完了が確認できなければ旧コンシューマ鍵と秘密の状態を推測しない
            if (applied.state !== 'complete') throw new Error('適用未確認');
            // サーバーから返された最新状態を検証する
            rows = stageRows(applied.stages);
            // 同じIDのrotatedが返ったことを確認する
            automationStage(rows, stage.id, 'rotated');
            // 適用後の旧コンシューマ鍵と秘密を削除せず表示する
            this.stages = rows;
            // 完了確認できた一覧だけを手動削除の対象にする
            this.stagesLoaded = true;
            // 全工程が完了した場合だけ成功を案内する
            this.dispatchEvent(
                new ShowToastEvent({
                    title: '成功',
                    message: '新しいコンシューマ鍵と秘密を適用しました。',
                    variant: 'success',
                    mode: 'pester'
                })
            );
        } catch {
            // 古い要求の失敗を別の画面接続へ反映しない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // 結果不明の一覧から変更を繰り返させない
            this.stagesLoaded = false;
            // 工程名と再取得手順だけを表示する
            this.error = `${phase}の完了を確認できません。処理を停止しました。設定を確認してから再実行してください。アプリを選択し直して現在の状態を確認してください。`;
        } finally {
            // 自動再送せず、本人による次の実行を受け付ける
            if (this.isConnected && operationVersion === this.operationVersion) this.busy = false;
        }
    }
}
