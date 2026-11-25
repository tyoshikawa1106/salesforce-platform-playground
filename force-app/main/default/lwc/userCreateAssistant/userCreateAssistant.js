import { LightningElement } from 'lwc';
import getForm from '@salesforce/apex/UserCreateAssistantController.getForm';
import saveUser from '@salesforce/apex/UserCreateAssistantController.saveUser';
import { buildConfirmationSections, buildPanels, getDraftValue, initialTargetValues } from './userCreateAssistantLogic';

const MATCHING_USERNAME = '新規ユーザーの「ユーザー名」がコピー元と同じです。右側の「ユーザー名」に、別の未使用のユーザー名を入力してください。';

// 参照元の選択から入力、割り当てを含む作成までを制御
export default class UserCreateAssistant extends LightningElement {
    // 同姓同名の利用者をユーザー名でも検索
    matchingInfo = { primaryField: { fieldPath: 'Name' }, additionalFields: [{ fieldPath: 'Username' }] };
    // 取引先責任者に紐づくユーザーはコピー対象外
    sourceFilter = { criteria: [{ fieldPath: 'ContactId', operator: 'eq', value: null }] };
    // 候補の氏名にユーザー名を併記
    displayInfo = { primaryField: 'Name', additionalFields: ['Username'] };
    // 現在の参照元を識別
    sourceId;
    // 取得時の値を編集前の基準として保持
    fields = [];
    // 読み込みの前後で別の対象に切り替わったことを検出
    generation = 0;
    // 利用者の選択以外の入力を読み込み完了後に表示
    panels;
    // 元側の変更と新規側の入力を別々に記録
    sourceDraft = {};
    // 新規側の初期値とその後の編集を保持
    targetDraft = {};
    // コピー元の編集は明示的に選択した場合だけ許可
    deactivateSource = false;
    // 直接割り当てとグループの両方を初期選択
    copyPermissionSets = true;
    // グループだけを独立して除外できるようにする
    copyPermissionSetGroups = true;
    // 読み込み中に空のフォームを表示しない
    loading = false;
    // DML が完了するまで二重送信と対象切り替えを禁止
    saving = false;
    // 確認時点の項目と値をモーダルの行に表示
    confirmationSections;
    // 入力に影響を与えずエラーを表示
    errorMessage;
    // 作成後に参照可能な新規ユーザーへのリンク
    createdUrl;

    connectedCallback() {
        // 離脱によって中断した読み込みだけを再開
        if (this.sourceId && !this.panels && !this.saving) this.loadSource();
    }

    disconnectedCallback() {
        // 画面を離れる前に発行した読み込みの応答を無効化
        this.generation += 1;
        // 再接続後は新しい確認操作から開始
        this.closeConfirmation();
    }

    handleSourceChange(event) {
        // 送信済みの作成要求が終わるまでその対象を維持
        if (this.saving) return;
        // 選択解除時は未入力画面に戻し、別の利用者の情報を残さない
        this.sourceId = event.detail.recordId || undefined;
        // 対象を変更したら前の元側編集を破棄
        this.sourceDraft = {};
        // 新しい対象からは独立した新規入力を開始
        this.targetDraft = {};
        // 元ユーザーを変更しない初期状態へ戻す
        this.deactivateSource = false;
        // 新規作成ごとに直接割り当ての引き継ぎを有効化
        this.copyPermissionSets = true;
        // グループ引き継ぎも初期状態に戻す
        this.copyPermissionSetGroups = true;
        // 前回の完了通知を閉じる
        this.createdUrl = undefined;
        // 選択中のユーザーに応じて参照元を表示
        this.loadSource();
    }

    async loadSource() {
        // この読み込みに固有の世代を確定
        const request = ++this.generation;
        // コピー元が変わったら前の確認を破棄
        this.closeConfirmation();
        // 前のユーザーの項目を直ちに画面から消す
        this.panels = undefined;
        // 古い項目定義を保持しない
        this.fields = [];
        // 再試行時に古いエラー表示を閉じる
        this.errorMessage = undefined;
        // 未選択なら読み込みを終了
        this.loading = Boolean(this.sourceId);
        // 対象が確定した場合だけ問い合わせる
        if (!this.sourceId) return;
        try {
            // 型やアクセス権をコピー元と同じ応答で取得
            const form = await getForm({ sourceId: this.sourceId });
            // 対象切替や画面離脱前の応答を破棄
            if (request !== this.generation) return;
            // フィールド定義をフォームの基準値として保存
            this.fields = form.fields;
            // コピー元の後続編集から独立した初期値を保存時にも使用
            this.targetDraft = initialTargetValues(this.fields);
            // 対象が確定した時点で両側の項目を構築
            this.rebuildPanels();
        } catch (error) {
            // 別のユーザーに対する失敗を表示しない
            if (request === this.generation) this.errorMessage = error.body?.message || 'コピー元ユーザーを読み込めませんでした。';
        } finally {
            // 現在の要求の完了時だけ読み込み表示を終了
            if (request === this.generation) this.loading = false;
        }
    }

    rebuildPanels() {
        // 取得時の値と未保存の入力を左右に振り分ける
        this.panels = buildPanels(this.fields, this.deactivateSource, this.sourceDraft, this.targetDraft);
    }

    get gridStyle() {
        // 左右のボックスで同じグリッド行を共有し、入力形式が違っても項目を揃える
        return '--user-create-rows:' + (1 + (this.panels?.[0].rows.length || 0));
    }

    handleOptionChange(event) {
        // 保存中はすでに送信した条件を維持
        if (this.saving) return;
        // オプションに対応する状態だけを更新
        const { name, checked } = event.target;
        // 無効化を解除するときは元側の未保存変更も取り消す
        if (name === 'deactivateSource') {
            // 元側の表示モードを切り替える
            this.deactivateSource = checked;
            // 編集を取り消して選択時の値へ戻す
            if (!checked) this.sourceDraft = {};
            // 新規側の入力を引き継ぎながら元側の部品を変更
            this.rebuildPanels();
        } else if (name === 'copyPermissionSets') {
            // 個別に割り当てた権限セットの引き継ぎを選択
            this.copyPermissionSets = checked;
        } else if (name === 'copyPermissionSetGroups') {
            // 権限セットグループの引き継ぎを選択
            this.copyPermissionSetGroups = checked;
        }
    }

    handleLookupError(event) {
        // 標準ピッカーが対象オブジェクトの情報を扱えない場合に ID 入力へ切り替える
        if (!['ERR_RP002', 'ERR_RP003'].includes(event.detail?.error?.errorCode)) return;
        // 同じ参照先を持つ項目に同じ入力方法を適用
        const objectName = event.currentTarget.objectApiName;
        // 型の異なる項目や別オブジェクトの検索は維持
        this.fields = this.fields.map((field) => (field.referenceTo === objectName ? { ...field, referenceIdInput: true } : field));
        // 切り替え時に左右の入力内容を保持
        this.rebuildPanels();
    }

    handleFieldChange(event) {
        // 変更元の入力欄を特定
        const { side, name } = event.currentTarget.dataset;
        // 基本コンポーネントごとの値を選択解除も含めて受け取る
        const value = event.currentTarget.type === 'checkbox' ? event.currentTarget.checked :
            event.detail && 'recordId' in event.detail ? event.detail.recordId : event.detail?.value ?? event.currentTarget.value;
        // 最新の入力だけを保存要求に反映
        const draft = side === 'source' ? this.sourceDraft : this.targetDraft;
        // 同じ値に戻した元側項目を更新対象から外す
        const field = this.fields.find((item) => item.apiName === name);
        // 編集可否の切替後に届いた不要な入力を除外
        if (this.saving || (side === 'source' && !this.deactivateSource) || !field) return;
        if (name === 'Username') this.clearUsernameError();
        // 選択リストなどの表示形式をサーバー保存形式に変換
        const normalized = getDraftValue(value);
        // 最初の値と同じ元側項目の不要な更新を防ぐ
        if (side === 'source' && String(field.value ?? '') === String(normalized ?? '')) {
            // 差分だけをサーバーに送信
            delete draft[name];
        } else {
            // 入力を失敗後の再試行にも使えるよう保持
            draft[name] = normalized;
        }
    }

    get showRetry() {
        // 読み込みと保存の失敗で復旧操作を区別
        return !this.panels && !this.loading && Boolean(this.sourceId);
    }

    get saveLabel() {
        // 無効化を伴う操作は保存前にボタンでも明示
        return this.deactivateSource ? 'コピー元を無効化してユーザーを作成' : 'ユーザーを作成';
    }

    get errorHeading() {
        return this.panels ? 'ユーザーを作成できませんでした' : 'コピー元ユーザーを読み込めませんでした';
    }

    get sourceUsername() {
        return this.fields.find((field) => field.apiName === 'Username')?.value;
    }

    get hasMatchingUsernameError() {
        return this.errorMessage === MATCHING_USERNAME;
    }

    get targetUsernameInput() {
        return this.template.querySelector('[data-side="target"][data-name="Username"]');
    }

    focusTargetUsername() {
        this.targetUsernameInput?.focus();
    }

    clearUsernameError() {
        if (!this.hasMatchingUsernameError) return;
        const input = this.targetUsernameInput;
        input?.setCustomValidity('');
        input?.reportValidity();
        this.errorMessage = undefined;
    }

    reportMatchingUsername() {
        const source = this.deactivateSource ? this.sourceDraft.Username ?? this.sourceUsername : this.sourceUsername;
        const target = this.targetDraft.Username;
        if (!target || target.trim().toLowerCase() !== source?.trim().toLowerCase()) return false;
        this.errorMessage = MATCHING_USERNAME;
        const input = this.targetUsernameInput;
        input.setCustomValidity(this.errorMessage);
        input.reportValidity();
        input.focus();
        return true;
    }

    handleSave() {
        // 二重送信や未選択状態での作成を抑止
        if (this.saving || this.confirmationSections || !this.panels) return;
        this.clearUsernameError();
        // 必須・入力形式の問題をすべての編集欄に表示
        const invalid = Array.from(this.template.querySelectorAll('[data-side]')).filter((input) => !input.checkValidity());
        // 基本コンポーネントが返した個別の理由を表示
        invalid.forEach((input) => input.reportValidity());
        // 最初の入力エラーにフォーカスを移す
        if (invalid.length) {
            // 長いフォームでも修正箇所へ直接移動
            invalid[0].focus();
            // サーバーへの作成要求を保留
            return;
        }
        // 前回失敗の表示を解除
        this.errorMessage = undefined;
        // 表示中のフォームから確認内容を確定
        this.confirmationSections = buildConfirmationSections(this.sourceUsername, this.targetDraft,
            this.deactivateSource, this.copyPermissionSets, this.copyPermissionSetGroups);
        // ブラウザのモーダル表示で背景の操作とフォーカスを制限
        this.refs.confirmation.showModal();
    }

    closeConfirmation() {
        if (!this.confirmationSections) return;
        // 取り消し・離脱から古い確認結果を実行できないようにする
        this.confirmationSections = undefined;
        // 開いている場合だけフォームへフォーカスを戻す
        if (this.refs?.confirmation?.open) this.refs.confirmation.close();
    }

    async handleConfirmedSave() {
        // キャンセル後と二重送信は保存しない
        if (!this.confirmationSections || this.saving || !this.panels) return;
        // 入力エラーがあればモーダルを閉じたフォームに表示
        this.closeConfirmation();
        if (this.reportMatchingUsername()) return;
        try {
            this.saving = true;
            // コピー元の変更と割り当ては同じ保存要求で実行
            const id = await saveUser({ request: {
                sourceId: this.sourceId, deactivateSource: this.deactivateSource,
                copyPermissionSets: this.copyPermissionSets, copyPermissionSetGroups: this.copyPermissionSetGroups,
                sourceValuesJson: JSON.stringify(this.deactivateSource ? this.sourceDraft : {}),
                targetValuesJson: JSON.stringify(this.targetDraft)
            } });
            // 作成完了を表示し、同じ入力を再送できない状態に戻す
            this.createdUrl = '/lightning/r/User/' + id + '/view';
            // 次回は元ユーザーの最新状態を取り直す
            this.sourceId = undefined;
            // 入力済み項目を画面から除去
            this.panels = undefined;
            // 個人情報を含む編集中の値を解放
            this.fields = [];
            // 編集済みの元側項目を消去
            this.sourceDraft = {};
            // 作成済みの入力を消去
            this.targetDraft = {};
        } catch (error) {
            // 入力とチェック状態を維持して再試行できるようにする
            this.errorMessage = error.body?.message || 'ユーザーを作成できませんでした。入力内容と権限を確認してください。';
        } finally {
            // 再接続時も送信済みの要求が完了するまでロックを維持
            this.saving = false;
        }
    }
}
