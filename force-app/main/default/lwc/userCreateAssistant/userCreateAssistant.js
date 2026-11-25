import { LightningElement, wire } from 'lwc';
import { getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import USER_OBJECT from '@salesforce/schema/User';
import CURRENT_USER_ID from '@salesforce/user/Id';
import getSourceProfileIds from '@salesforce/apex/UserCreateAssistantController.getSourceProfileIds';
import getForm from '@salesforce/apex/UserCreateAssistantController.getForm';
import saveUser from '@salesforce/apex/UserCreateAssistantController.saveUser';
import { buildConfirmationSections, buildFieldLines, buildPanel, getDraftValue, initialTargetValues } from './userCreateAssistantLogic';

const MASTER_RECORD_TYPE_ID = '012000000000000AAA';
const ACCESS_ERROR_PREFIX = '利用権限の確認：';
const DEPENDENCY_ERROR = '連動選択リストの候補を取得できませんでした。';
const MATCHING_USERNAME = '新規ユーザーの「ユーザー名」がコピー元と同じです。右側の「ユーザー名」に、別の未使用のユーザー名を入力してください。';

// 参照元の選択から入力、割り当てを含む作成までを制御
export default class UserCreateAssistant extends LightningElement {
    // 同姓同名の利用者をユーザー名でも検索
    matchingInfo = { primaryField: { fieldPath: 'Name' }, additionalFields: [{ fieldPath: 'Username' }] };
    // Apex の保存条件と同じ社内プロファイルで検索する
    sourceProfileIds;
    // 初期取得の失敗と権限不足を画面に通知する
    profileError;
    // 離脱前に開始した権限確認の結果を破棄する
    profileRequest = 0;

    get sourceFilter() {
        // 外部ユーザーおよび取引先責任者に紐づくユーザーを候補から除く
        return { criteria: [
            { fieldPath: 'ContactId', operator: 'eq', value: null },
            { fieldPath: 'ProfileId', operator: 'in', value: this.sourceProfileIds }
        ] };
    }

    get sourcePickerDisabled() {
        // 検索条件が確定するまで、または保存中は選択を止める
        return !this.sourceProfileIds?.length || this.saving;
    }

    async loadSourceProfiles() {
        // 画面の接続時に現在の権限で検索条件を取得する
        const request = ++this.profileRequest;
        this.sourceProfileIds = undefined;
        this.profileError = undefined;
        try {
            const profiles = await getSourceProfileIds();
            // 古い接続の結果でフォームを開かない
            if (request !== this.profileRequest) return;
            this.sourceProfileIds = profiles;
            // 再接続時は保持した入力値でフォームを復元し、中断した取得だけを再開する
            if (this.panels) this.rebuildPanels();
            else if (this.sourceId && this.loading && !this.fields.length && !this.saving) this.loadSource();
        } catch (error) {
            if (request !== this.profileRequest) return;
            if (!this.handleAccessDenial(error)) this.profileError = 'コピー元の検索条件を取得できませんでした。';
        }
    }

    handleAccessDenial(error) {
        // 実行中に権限を失った場合も、入力中のユーザー情報を画面から取り除く
        const message = error.body?.message;
        if (!message?.startsWith(ACCESS_ERROR_PREFIX)) return false;
        this.profileRequest += 1;
        this.sourceProfileIds = undefined;
        this.sourceId = undefined;
        this.sourceDraft = {};
        this.targetDraft = {};
        this.createdUrl = undefined;
        this.loadSource();
        this.profileError = message.slice(ACCESS_ERROR_PREFIX.length);
        return true;
    }

    // 候補の氏名にユーザー名を併記
    displayInfo = { primaryField: 'Name', additionalFields: ['Username'] };
    // 現在の参照元を識別
    sourceId;
    // 取得時の値を編集前の基準として保持
    fields = [];
    // 読み込みの前後で別の対象に切り替わったことを検出
    generation = 0;
    // 左右で共有する見出し・項目順・2列の組み合わせ
    fieldLines;
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
    // 新規ユーザーにはパスワードリセットメールを送る設定で開始
    sendResetEmail = true;
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
        // フォームを表示する前に利用権限を確認する
        this.loadSourceProfiles();
    }

    disconnectedCallback() {
        // 接続時の権限確認を無効にする
        this.profileRequest += 1;
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
        this.sendResetEmail = true;
        // 前回の完了通知を閉じる
        this.createdUrl = undefined;
        // 選択中のユーザーに応じて参照元を表示
        this.loadSource();
    }

    dependencyRecordTypeId;

    @wire(getPicklistValuesByRecordType, { objectApiName: USER_OBJECT, recordTypeId: '$dependencyRecordTypeId' })
    loadDependencies({data, error}) {
        if (!this.dependencyRecordTypeId || (!data && !error)) return;
        const dependencies = data?.picklistFieldValues;
        if (!dependencies || this.fields.some(field => field.controllerName && !dependencies[field.apiName])) {
            this.closeConfirmation();
            this.dependencyRecordTypeId = undefined;
            this.loading = false;
            // 保存中はフォームをロックしたまま、保存結果を待つ
            if (this.saving) return;
            this.panels = undefined;
            this.showError(DEPENDENCY_ERROR);
            return;
        }
        this.fields = this.fields.map(field => (field.controllerName ? {...field, dependency: dependencies[field.apiName]} : field));
        this.rebuildPanels();
        this.loading = false;
        if (this.confirmationSections && this.reportInvalidChoices()) this.closeConfirmation();
    }

    async loadSource() {
        // この読み込みに固有の世代を確定
        const request = ++this.generation;
        // コピー元が変わったら前の確認を破棄
        this.closeConfirmation();
        // 前のユーザーの項目を直ちに画面から消す
        this.panels = undefined;
        this.fieldLines = undefined;
        // 古い項目定義を保持しない
        this.fields = [];
        this.dependencyRecordTypeId = undefined;
        // 対象が変わったら以前のエラーを閉じる
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
            if (this.fields.some(field => field.controllerName)) {
                // User はマスターレコードタイプの選択肢を使用する。
                this.dependencyRecordTypeId = MASTER_RECORD_TYPE_ID;
            } else {
                this.rebuildPanels();
            }
        } catch (error) {
            // 別のユーザーに対する失敗を表示しない
            if (request === this.generation && !this.handleAccessDenial(error)) this.showError(error.body?.message || 'コピー元ユーザーを読み込めませんでした。');
        } finally {
            // 現在の要求の完了時だけ読み込み表示を終了
            if (request === this.generation && !this.dependencyRecordTypeId) this.loading = false;
        }
    }

    rebuildPanels() {
        // コピー元や項目定義が変わったときに共通の行配置を確定
        this.fieldLines = buildFieldLines(this.fields);
        this.panels = [
            buildPanel(this.fieldLines, 'source', this.sourceDraft, this.deactivateSource),
            buildPanel(this.fieldLines, 'target', this.targetDraft)
        ];
    }

    get gridStyle() {
        // 左右のボックスで同じグリッド行を共有し、入力形式が違っても項目を揃える
        return '--user-create-rows:' + (1 + (this.panels?.[0].rows.length || 0));
    }

    get isCurrentUserSource() {
        // ピッカーとログインユーザーの ID を15桁・18桁のどちらでも照合する
        return this.sourceId?.slice(0, 15) === CURRENT_USER_ID.slice(0, 15);
    }

    get disableDeactivation() {
        // 本人の無効化と、保存中の選択変更を防ぐ
        return this.isCurrentUserSource || this.saving;
    }

    handleOptionChange(event) {
        // 保存中はすでに送信した条件を維持
        if (this.saving) return;
        // オプションに対応する状態だけを更新
        const { name, checked } = event.target;
        // 無効化を解除するときは元側の未保存変更も取り消す
        if (name === 'deactivateSource') {
            // ログインユーザーの項目は常に参照専用に保つ
            if (this.isCurrentUserSource) return;
            // 元側の表示モードを切り替える
            this.deactivateSource = checked;
            // 編集を取り消して選択時の値へ戻す
            if (!checked) this.sourceDraft = {};
            // 元側だけを編集・参照表示に切り替え、新規側の入力部品を維持
            this.panels = [buildPanel(this.fieldLines, 'source', this.sourceDraft, checked), this.panels[1]];
        } else if (name === 'copyPermissionSets') {
            // 個別に割り当てた権限セットの引き継ぎを選択
            this.copyPermissionSets = checked;
        } else if (name === 'sendResetEmail') {
            this.sendResetEmail = checked;
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
        if (field.type === 'picklist' || field.type === 'multipicklist' || this.fields.some(item => item.controllerName === name)) {
            const panel = buildPanel(this.fieldLines, side, draft, this.deactivateSource);
            this.panels = this.panels.map(existing => (existing.side === side ? panel : existing));
        }
    }

    get displayedError() {
        return this.sourceProfileIds ? this.errorMessage : this.profileError;
    }

    get checkingAccess() {
        return !this.sourceProfileIds && !this.profileError;
    }

    get saveLabel() {
        // 無効化を伴う操作は保存前にボタンでも明示
        return this.deactivateSource ? 'コピー元を無効化してユーザーを作成' : 'ユーザーを作成';
    }

    get errorHeading() {
        if (!this.sourceProfileIds) return undefined;
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

    async showError(message) {
        // エラーを描画してから見出し直下の通知へ移動する。
        this.errorMessage = message;
        await Promise.resolve();
        if (this.errorMessage === message && this.isConnected) {
            this.refs?.errorSummary?.focus();
            this.refs?.errorSummary?.scrollIntoView?.({ block: 'center' });
        }
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
        this.showError(MATCHING_USERNAME);
        const input = this.targetUsernameInput;
        input.setCustomValidity(this.errorMessage);
        input.reportValidity();
        return true;
    }

    reportInvalidChoices() {
        const invalidChoices = this.panels.flatMap(panel => panel.rows.flatMap(line => line.cells
            .filter(cell => cell.invalidChoice).map(cell => panel.label + 'の「' + cell.label + '」')));
        if (invalidChoices.length) {
            this.showError(invalidChoices.join('、') + ' に選択対象外の値があります。選び直すか解除してください。');
            return true;
        }
        return false;
    }

    handleSave() {
        // 二重送信や未選択状態での作成を抑止
        if (this.saving || this.confirmationSections || !this.panels) return;
        this.clearUsernameError();
        // 必須・入力形式の問題をすべての編集欄に表示
        const invalid = Array.from(this.template.querySelectorAll('[data-side]')).filter(input => {
            if (input.dataset.rich === undefined) return !input.checkValidity();
            // リッチテキストは標準の制約検証 API を持たない。画像だけの入力も有効。
            const html = input.value || '';
            const content = html.replace(/<[^>]*>|&nbsp;/gi, '').trim() || /<img\b/i.test(html);
            input.valid = (!input.required || Boolean(content)) && (!Number(input.dataset.limit) || html.length <= Number(input.dataset.limit));
            return !input.valid;
        });
        // 基本コンポーネントが返した個別の理由を表示
        invalid.forEach((input) => input.reportValidity?.());
        // 入力エラーを上部の通知にまとめる
        if (invalid.length) {
            // コピー元・新規のどちらにある項目かを示す
            const labels = invalid.map(input => (input.dataset.side === 'source' ? 'コピー元' : '新規') + 'の「' + input.label + '」');
            this.showError(labels.join('、') + ' の入力内容を確認してください。');
            // サーバーへの作成要求を保留
            return;
        }
        if (this.reportInvalidChoices()) return;
        if (this.reportMatchingUsername()) return;
        // 前回失敗の表示を解除
        this.errorMessage = undefined;
        // 表示中のフォームから確認内容を確定
        this.confirmationSections = buildConfirmationSections(this.fields, this.sourceDraft, this.targetDraft, {
            deactivateSource: this.deactivateSource, copyPermissionSets: this.copyPermissionSets,
            copyPermissionSetGroups: this.copyPermissionSetGroups, sendResetEmail: this.sendResetEmail
        });
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
        try {
            this.saving = true;
            // コピー元の変更と割り当ては同じ保存要求で実行
            const id = await saveUser({ request: {
                sourceId: this.sourceId, deactivateSource: this.deactivateSource,
                copyPermissionSets: this.copyPermissionSets, copyPermissionSetGroups: this.copyPermissionSetGroups,
                sendResetEmail: this.sendResetEmail,
                sourceValuesJson: JSON.stringify(this.deactivateSource ? this.sourceDraft : {}),
                targetValuesJson: JSON.stringify(this.targetDraft)
            } });
            // 作成完了を表示し、同じ入力を再送できない状態に戻す
            this.createdUrl = '/lightning/r/User/' + id + '/view';
            // 次回は元ユーザーの最新状態を取り直す
            this.sourceId = undefined;
            this.dependencyRecordTypeId = undefined;
            // 保存成功後はこのフォームに対する通知を終了する
            this.errorMessage = undefined;
            this.loading = false;
            // 入力済み項目を画面から除去
            this.panels = undefined;
            this.fieldLines = undefined;
            // 個人情報を含む編集中の値を解放
            this.fields = [];
            // 編集済みの元側項目を消去
            this.sourceDraft = {};
            // 作成済みの入力を消去
            this.targetDraft = {};
        } catch (error) {
            // 権限不足では保存の再試行より先に利用権限を再確認する
            if (this.handleAccessDenial(error)) return;
            // 入力とチェック状態を維持して再試行できるようにする
            const message = error.body?.message || 'ユーザーを作成できませんでした。入力内容と権限を確認してください。';
            // 保存中に候補も失効していれば、編集を閉じて両方のエラーを表示する
            if (!this.dependencyRecordTypeId && this.fields.some(field => field.controllerName)) {
                this.panels = undefined;
                this.showError(message + ' ' + DEPENDENCY_ERROR);
            } else {
                this.showError(message);
            }
        } finally {
            // 再接続時も送信済みの要求が完了するまでロックを維持
            this.saving = false;
        }
    }
}
