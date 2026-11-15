import { LightningElement } from 'lwc';
import getSettings from '@salesforce/apex/UserLocaleSettingsController.getSettings';
import saveSettings from '@salesforce/apex/UserLocaleSettingsController.saveSettings';
import { createOptions, selectDefaultLocale, getDisplayLabel, createSaveRequest } from './userLocaleSettingsLogic';

// 本人の言語・地域の参照、編集、保存を制御
export default class UserLocaleSettings extends LightningElement {
    // 保存済みの設定を保持
    settings = { language: '', locale: '', canEdit: false };
    // 表示順に整えた言語候補を保持
    languageOptions = [];
    // 表示順に整えた地域候補を保持
    localeOptions = [];
    // 編集中の言語を保存値と分離
    language = '';
    // 編集中の地域を保存値と分離
    locale = '';
    // 初期状態は参照表示
    isEditing = false;
    // 初回取得前の操作を禁止
    isLoading = true;
    // 保存中の再実行を防止
    isSaving = false;
    // 初期取得成功後だけ現在値を表示
    isLoaded = false;
    // 再試行可能な失敗を表示
    errorMessage = '';
    // 接続し直した後に古い応答を採用しない
    operationVersion = 0;

    // 配置時と再接続時に最新の設定を取得
    connectedCallback() {
        // 初期表示の取得を開始
        this.loadSettings();
    }

    // 画面を離れた後の応答で状態や画面を変更しない
    disconnectedCallback() {
        // 進行中の画面処理を無効化
        this.operationVersion += 1;
    }

    // 再読み込み操作から取得を再実行
    handleRetry() {
        // 処理中の重複取得を防止
        if (this.isBusy) return;
        // 取得に失敗した設定を再取得
        this.loadSettings();
    }

    // 本人の現在値と選択肢を取得
    async loadSettings() {
        // 今回の接続で開始した処理を識別
        const version = ++this.operationVersion;
        // 取得中の状態へ遷移
        this.isLoading = true;
        // 再接続時の古い保存状態を解除
        this.isSaving = false;
        // 取得前の編集を終了
        this.isEditing = false;
        // 古い設定を現在値として表示しない
        this.isLoaded = false;
        // 前回の失敗案内を解除
        this.errorMessage = '';
        // 通信失敗後に再取得できるよう捕捉
        try {
            // キャッシュを使わず最新の本人設定を取得
            const settings = await getSettings();
            // 古い接続の応答を破棄
            if (!this.isConnected || version !== this.operationVersion) return;
            // サーバーで判定された取得失敗を表示
            if (settings.errorMessage) {
                // 再試行案内として保持
                this.errorMessage = settings.errorMessage;
                // 不完全なデータで表示しない
                return;
            }
            // 言語候補は日本語・英語を優先
            this.languageOptions = createOptions(settings.languages, true);
            // 地域候補の表示順を確定
            this.localeOptions = createOptions(settings.locales);
            // 保存済みの現在値を保持
            this.settings = settings;
            // 取得済みの参照表示へ遷移
            this.isLoaded = true;
        } catch {
            // 現在の接続に対する失敗だけを表示
            if (this.isConnected && version === this.operationVersion) {
                // 内部例外を公開せず再試行を案内
                this.errorMessage = '言語・地域を取得できませんでした。再読み込みしてください。';
            }
        } finally {
            // 古い応答で新しい取得中状態を解除しない
            if (this.isConnected && version === this.operationVersion) {
                // 操作を再開できる状態へ遷移
                this.isLoading = false;
            }
        }
    }

    // 保存値を変えずに編集用の値を準備
    handleEdit() {
        // 未取得や権限不足の編集を禁止
        if (this.editDisabled) return;
        // 現在の言語をそのまま引き継ぐ
        this.language = this.settings.language;
        // 言語変更前は現在の地域を維持
        this.locale = this.settings.locale;
        // 前回の失敗案内を解除
        this.errorMessage = '';
        // 編集表示へ遷移
        this.isEditing = true;
    }

    // 言語変更に合わせて地域の初期値を設定
    handleLanguageChange(event) {
        // 保存中や参照中は編集しない
        if (this.isBusy || !this.isEditing) return;
        // 同じ言語の通知では手動選択した地域を維持
        if (this.language === event.detail.value) return;
        // 新しい言語を編集値へ反映
        this.language = event.detail.value;
        // 有効な地域が決まる場合だけ自動設定
        this.locale = selectDefaultLocale(this.language, this.localeOptions);
        // 修正前のエラーを解除
        this.errorMessage = '';
    }

    // 自動設定後も利用者が地域を調整可能にする
    handleLocaleChange(event) {
        // 保存中や参照中は編集しない
        if (this.isBusy || !this.isEditing) return;
        // 利用者が選んだ地域を保持
        this.locale = event.detail.value;
        // 修正前のエラーを解除
        this.errorMessage = '';
    }

    // 未保存の変更を破棄して参照表示へ戻る
    handleCancel() {
        // 保存中は結果が確定するまで待機
        if (this.isBusy) return;
        // 編集値を保存済みの言語へ戻す
        this.language = this.settings.language;
        // 編集値を保存済みの地域へ戻す
        this.locale = this.settings.locale;
        // 編集を終了
        this.isEditing = false;
        // 未保存のエラーを解除
        this.errorMessage = '';
    }

    // 本人の設定を保存し、Salesforce全体へ反映するため再読み込み
    async handleSave() {
        // 二重保存と参照中の更新を防止
        if (this.isBusy || !this.isEditing) return;
        // 候補外の値をサーバーへ送信しない
        const request = createSaveRequest(this.language, this.locale, this.languageOptions, this.localeOptions);
        // 項目を修正できる形で入力エラーを表示
        this.errorMessage = request.errorMessage;
        // 不正な入力は保存しない
        if (this.errorMessage) return;
        // 保存開始時の接続を記録
        const version = this.operationVersion;
        // 保存完了まで入力を固定
        this.isSaving = true;
        // 失敗後も編集値を保持して再試行可能にする
        try {
            // ユーザーIDを受け付けない公開APIで本人を更新
            const result = await saveSettings(request.parameters);
            // 画面を離れた後に再読み込みしない
            if (!this.isConnected || version !== this.operationVersion) return;
            // サーバー側の入力・権限エラーを表示
            if (result.errorMessage) {
                // 編集内容を保持したまま拒否理由を表示
                this.errorMessage = result.errorMessage;
                // 保存済みとして扱わない
                return;
            }
            // 保存成功後は新しい値を参照表示へ反映
            this.settings = { ...this.settings, language: result.language, locale: result.locale };
            // 再読み込みまでの再保存を防止
            this.isEditing = false;
            // 標準画面の表示言語・地域を更新
            window.location.reload();
        } catch {
            // 現在の接続に対する失敗だけを表示
            if (this.isConnected && version === this.operationVersion) {
                // 再読み込み失敗と保存失敗を区別
                this.errorMessage = this.isEditing
                    ? '保存できませんでした。権限を確認して再実行してください。'
                    : '保存しました。画面を再読み込みしてください。';
            }
        } finally {
            // 古い保存結果で新しい接続を変更しない
            if (this.isConnected && version === this.operationVersion) {
                // 再試行できる状態へ戻す
                this.isSaving = false;
            }
        }
    }

    // 通信中の状態を操作制御へ集約
    get isBusy() {
        // 取得と保存のいずれかを待機
        return this.isLoading || this.isSaving;
    }

    // 取得成功と権限確認後だけ編集を許可
    get editDisabled() {
        // 通信中・未取得・権限不足の編集を禁止
        return this.isBusy || !this.isLoaded || !this.settings.canEdit;
    }

    // 保存済みの言語を表示名へ変換
    get languageLabel() {
        // 編集値ではなく現在値を参照
        return getDisplayLabel(this.settings.language, this.languageOptions);
    }

    // 保存済みの地域を表示名へ変換
    get localeLabel() {
        // 編集値ではなく現在値を参照
        return getDisplayLabel(this.settings.locale, this.localeOptions);
    }

    // 取得失敗後だけ再試行を表示
    get showRetry() {
        // 初期取得中に不要な再試行を出さない
        return !this.isLoaded && !this.isLoading;
    }

    // 参照可能でも更新できない場合の案内
    get showReadOnlyMessage() {
        // 権限を確認した結果だけを表示
        return this.isLoaded && !this.settings.canEdit;
    }
}
