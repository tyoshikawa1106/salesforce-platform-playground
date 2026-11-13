import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { LightningElement } from 'lwc';
import LightningConfirm from 'lightning/confirm';
import ExternalClientAppCredentialModal from 'c/externalClientAppCredentialModal';
import getAuthentication from '@salesforce/apex/ExternalClientAppManagerController.getAuthentication';
import getAuthenticationUrl from '@salesforce/apex/ExternalClientAppManagerController.getAuthenticationUrl';
import revokeAuthentication from '@salesforce/apex/ExternalClientAppManagerController.revokeAuthentication';
import execute from '@salesforce/apex/ExternalClientAppManagerController.execute';
import {
    applicationOptions,
    errorMessage,
    stageRows,
    stageBlockingMessage,
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
    // 候補とキーボードの強調位置を表示用に保持する
    appOptions = applicationOptions();
    // 入力文字列をサーバー検索に使用する
    appTerm = '';
    // 候補検索中も次の文字を入力できる状態を保つ
    candidatesBusy = false;
    // クリックまたは入力したときだけ候補を開く
    candidatesOpen = false;
    // キーボードの強調位置を確定済みの選択と区別する
    activeCandidateIndex = -1;
    // 前の検索応答が新しい候補を上書きしないようにする
    searchVersion = 0;
    // 更新後も利用者の選択を維持する
    appId = '';
    // 選択表示の切り替え後にキーボード操作を継続する
    focusLookupAfterRender = false;
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
        // 接続確認に成功するまでは状態分類によらず認証操作を表示する
        return !this.authenticationReady;
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
        // 離脱前の検索結果で候補を開き直さない
        this.closeCandidates();
        // 送信済み要求は取り消さず、応答後の後続操作だけを無効化する
        this.operationVersion += 1;
        // 離脱前の一覧から削除や状態判断を再開させない
        this.stagesLoaded = false;
        // 古い公開属性も復帰時へ持ち越さない
        this.stages = [];
    }

    async loadApplications() {
        // 認証確認を始める前の検索応答を破棄する
        this.closeCandidates();
        // この画面接続で開始した処理だけを継続する
        const operationVersion = this.operationVersion;
        // 再接続時も本人確認が終わるまで操作画面を隠す
        this.authenticationStatus = 'CHECKING';
        // 前回の取得結果を最新状態として表示しない
        this.stagesLoaded = false;
        // 今回の取得結果だけを案内する
        this.error = '';
        // 古いフロー用URLを再利用しない
        this.authenticationUrl = '';
        // 認証状態と一覧を取得する間は操作を固定する
        this.busy = true;
        try {
            // 未認証の接続へアプリ一覧を要求しない
            let authentication;
            try {
                authentication = await getAuthentication();
            } catch {
                // 接続確認の失敗だけでは認証開始を妨げない
                authentication = { status: 'UNAVAILABLE' };
            }
            // 離脱または再接続後は後続のAPI送信と画面更新を行わない
            if (!this.isConnected || operationVersion !== this.operationVersion) return;
            // サーバーで判定した状態だけを使用する
            this.authenticationStatus = authentication?.status || 'UNAVAILABLE';
            // 接続確認と独立した標準URLを使って認証をやり直せるようにする
            if (!this.authenticationReady) {
                try {
                    const url = await getAuthenticationUrl();
                    // 古い画面接続へ認証URLを戻さない
                    if (!this.isConnected || operationVersion !== this.operationVersion) return;
                    this.authenticationUrl = url || '';
                } catch {
                    // URLが作れない設定不備は無効ボタンと固定案内で示す
                    if (!this.isConnected || operationVersion !== this.operationVersion) return;
                    this.error = '認証を開始できません。接続設定と権限を管理者に確認してください。';
                    return;
                }
                // 接続確認失敗を認証成功や明示的な失効と混同しない
                this.error = this.authenticationUrl
                    ? (this.authenticationStatus === 'REQUIRED' ? '' : '認証状態を確認できません。認証をやり直すか、接続設定と権限を確認してください。')
                    : '認証を開始できません。接続設定と権限を管理者に確認してください。';
                return;
            }
            // 選択済みならIDで照合し、未選択なら保持中の検索語で候補を再取得する
            const response = await execute({ input: { action: 'list', ...(this.appId ? { appId: this.appId } : { term: this.appTerm }) } });
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
        if (this.busy || !this.authenticationRequired || !this.authenticationUrl) {
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
            // 解除前の検索語を次の認証へ持ち越さない
            this.appTerm = '';
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
        const appId = event.currentTarget.dataset.id;
        // 現在の検索結果にない候補は選択させない
        if (!this.applications.some((app) => app.id === appId)) return;
        // 遅延した検索結果が選択済みの候補を消さないようにする
        this.closeCandidates();
        // 選択したIDを後続の照合と更新に使う
        this.appId = appId;
        // 消える検索入力から選択解除ボタンへフォーカスを移す
        this.focusLookupAfterRender = true;
        // 前の対象のエラーを持ち越さない
        this.error = '';
        // 前の対象の資格情報を表示しない
        this.stages = [];
        // 新しい対象の取得前に空一覧と判断しない
        this.stagesLoaded = false;
        // 再訪時もサーバーに残っている資格情報を取得する
        if (this.appId) await this.handleStagesRefresh();
    }

    get selectedAppLabel() {
        // 確定したアプリの表示名を選択済み項目へ表示する
        return this.applications.find((app) => app.id === this.appId)?.label || '';
    }

    get lookupContainerClass() {
        // 選択状態をSLDSの入力枠へ反映する
        return `slds-combobox_container${this.appId ? ' slds-has-selection' : ''}`;
    }

    get lookupComboboxClass() {
        // 候補を開いている間だけドロップダウンを表示する
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click${this.candidatesOpen ? ' slds-is-open' : ''}`;
    }

    get appListboxId() {
        // 存在する候補領域だけを入力から参照する
        return this.candidatesOpen ? 'app-options' : null;
    }

    get activeAppOptionId() {
        // 読み上げの対象とキーボードの強調位置を揃える
        return this.candidatesOpen ? this.appOptions[this.activeCandidateIndex]?.domId || null : null;
    }

    get noCandidates() {
        // 通信失敗を検索結果なしとして案内しない
        return !this.candidatesBusy && !this.error && !this.appOptions.length;
    }

    renderedCallback() {
        // 取得中の無効なボタンを避け、表示切り替えが完了してから移動する
        if (this.focusLookupAfterRender && !this.busy) {
            // フォーカスイベントによる再描画では繰り返さない
            this.focusLookupAfterRender = false;
            // 選択後は解除ボタン、解除後は検索入力を操作対象にする
            this.template.querySelector(this.appId ? '.slds-pill__remove' : 'input[role="combobox"]')?.focus();
        }
        // キーボードで移動した候補をスクロール領域内に表示する
        if (this.candidatesOpen && this.activeCandidateIndex >= 0) {
            // 入力のフォーカスは動かさず候補だけを可視化する
            this.template.querySelector('[role="option"][aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
        }
    }

    handleAppSearch(event) {
        // 更新中と選択済みの対象に対する検索要求を拒否する
        if (this.busy || this.appId) return;
        // 入力のたびに全体から検索し直す
        this.appTerm = event.target.value;
        // 取得済み200件の中だけでは絞り込まない
        this.searchApplications();
    }

    openCandidates() {
        // 選択中や更新中に候補を開かない
        if (this.busy || this.appId) return;
        // 途中で閉じて破棄した検索は現在の入力でやり直す
        if (!this.applications.length) { this.searchApplications(); return; }
        // 初期取得済みの候補をクリックで表示する
        this.candidatesOpen = true;
    }

    closeCandidates() {
        // フォーカス移動後や選択後に古い検索で開き直さない
        this.searchVersion += 1;
        // 候補領域を閉じる
        this.candidatesOpen = false;
        // 取り消した検索の待機表示を解除する
        this.candidatesBusy = false;
        // 次回の候補に以前の位置を対応づけない
        this.activeCandidateIndex = -1;
        // 強調表示も選択位置と同期する
        this.appOptions = applicationOptions(this.applications);
    }

    handleLookupBlur(event) {
        // 表示切り替えで消える要素のblurでは再検索を中止しない
        if (this.focusLookupAfterRender) return;
        // 同じ候補領域内での移動では閉じない
        if (!event.currentTarget.contains(event.relatedTarget)) this.closeCandidates();
    }

    handleOptionMouseDown(event) {
        // 候補クリックが終わる前に入力欄からフォーカスを外さない
        event.preventDefault();
    }

    async searchApplications() {
        // 現在の入力に対応する応答だけを採用する
        const searchVersion = ++this.searchVersion;
        // 新しい検索結果が届くまで前の候補を選択させない
        this.applications = [];
        // 前の候補の表示も同時に解除する
        this.appOptions = applicationOptions();
        // 検索結果ごとに強調位置を解除する
        this.activeCandidateIndex = -1;
        // 待機表示は入力を妨げず候補内に出す
        this.candidatesBusy = true;
        // 入力した時点で候補領域を開く
        this.candidatesOpen = true;
        // 前回の検索エラーを持ち越さない
        this.error = '';
        try {
            // 名前の条件を含めて最大200件を取得する
            const response = await execute({ input: { action: 'list', term: this.appTerm } });
            // 別の入力・選択・離脱後に古い結果を反映しない
            if (!this.isConnected || searchVersion !== this.searchVersion) return;
            // 後続操作の照合に使う公開属性を保持する
            this.applications = response.applications || [];
            // 再取得した候補と強調位置を表示へ反映する
            this.appOptions = applicationOptions(this.applications);
        } catch (error) {
            // 前の検索失敗で現在の結果を上書きしない
            if (!this.isConnected || searchVersion !== this.searchVersion) return;
            // 検索できない理由を公開用の案内で表示する
            this.error = errorMessage(error);
        } finally {
            // 現在の要求だけが待機表示を解除する
            if (this.isConnected && searchVersion === this.searchVersion) this.candidatesBusy = false;
        }
    }

    handleAppClear() {
        // 資格情報の変更中は対象を解除しない
        if (this.busy) return;
        // 未選択状態へ戻し、適用ボタンを隠す
        this.appId = '';
        // 前の検索語を解除する
        this.appTerm = '';
        // 別アプリの資格情報を残さない
        this.stages = [];
        // 新たな選択後の取得まで一覧を公開しない
        this.stagesLoaded = false;
        // 解除後は条件なしの候補を再取得する
        this.searchApplications();
        // 新しい検索入力が描画されてからフォーカスを戻す
        this.focusLookupAfterRender = true;
    }

    handleSearchKey(event) {
        // IME変換中や対象固定中の入力を候補選択に使わない
        if (event.isComposing || this.busy || this.appId) return;
        // 通常の文字入力はブラウザへ委ねる
        if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return;
        // 候補操作中はページのスクロールとフォーム送信を防ぐ
        event.preventDefault();
        // Escapeは入力を維持して候補だけを閉じる
        if (event.key === 'Escape') { this.closeCandidates(); return; }
        // 閉じた候補へEnterで確定しない
        if (!this.candidatesOpen) {
            // 矢印では候補を開いてから選択を始める
            if (event.key !== 'Enter') this.openCandidates();
            return;
        }
        // 検索中や空の結果からは選択しない
        if (!this.appOptions.length) return;
        // Enterは強調候補か唯一の候補を確定する
        if (event.key === 'Enter') {
            // 複数の候補から自動で先頭を選ばない
            const option = this.appOptions[this.activeCandidateIndex] || (this.appOptions.length === 1 ? this.appOptions[0] : null);
            // クリックと同じ選択処理へ渡す
            if (option) this.handleAppChange({ currentTarget: { dataset: { id: option.value } } });
            return;
        }
        // 上下キーで候補の範囲を循環する
        const step = event.key === 'ArrowDown' ? 1 : -1;
        // 初回は下キーで先頭、上キーで末尾へ移動する
        this.activeCandidateIndex = this.activeCandidateIndex < 0
            ? (step > 0 ? 0 : this.appOptions.length - 1)
            : (this.activeCandidateIndex + step + this.appOptions.length) % this.appOptions.length;
        // 強調表示と読み上げ対象を同時に更新する
        this.appOptions = applicationOptions(this.applications, this.activeCandidateIndex);
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
            // 現在の状態に合う確認・整理方法を案内する
            const blockingMessage = stageBlockingMessage(rows);
            // 整理が必要な資格情報がある場合は変更前に停止する
            if (blockingMessage) {
                this.error = blockingMessage;
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
                this.error = stageBlockingMessage(rows) || '未適用の資格情報が残っています。アプリを選択し直して現在の状態を確認してください。';
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
            this.error = `${phase}の完了を確認できません。処理を停止しました。アプリを選択し直して現在の状態を確認してください。資格情報が変更されている可能性があるため、状態を確認するまで再実行しないでください。`;
        } finally {
            // 自動再送せず、本人による次の実行を受け付ける
            if (this.isConnected && operationVersion === this.operationVersion) this.busy = false;
        }
    }
}
