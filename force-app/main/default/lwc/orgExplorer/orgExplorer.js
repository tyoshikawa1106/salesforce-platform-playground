import { withUiErrorBoundary } from 'c/uiErrorBoundary';
import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getCapabilities from '@salesforce/apex/OrgExplorerController.getCapabilities';
import getPage from '@salesforce/apex/OrgExplorerController.getPage';
import searchRoles from '@salesforce/apex/OrgExplorerController.searchRoles';
import searchManagers from '@salesforce/apex/OrgExplorerController.searchManagers';
import {
    createGraph,
    createStructureGraph,
    structurePageNodes,
    managerBrowseCandidates,
    lookupCandidate,
    buildView,
    selectView,
    memberView,
    memberSelectionLabel,
    memberColumns,
    memberProfileIds,
    userProfileReference,
    memberPageLabel
} from './orgExplorerLogic';

// 画面操作、非同期要求、選択同期を一つの入口で調整する。
export default class OrgExplorer extends withUiErrorBoundary(NavigationMixin(LightningElement), 'orgExplorer') {
    // [初期値設定] 初期ロールのAPI名。空文字なら未選択で全ロールを表示する。
    @api defaultRootRoleApiName = 'SampleCompany';
    // [初期値設定] 無効ユーザー表示の初期状態。trueでON、falseでOFFにする。
    includeInactive = true;

    // 検索を実行済みの起点を表示条件として保持する。
    rootTarget = null;
    // ルックアップで確定した選択値を表示部品へ渡す。
    candidateTarget = null;
    // 初期値の適用後は、利用者が選んだ表示範囲を維持する。
    _rootInitialized = false;
    // 候補上限を超える場合は追加の絞り込みを促す。
    lookupHasMore = false;
    // 未入力候補だけを全上司構造から保持し、追加照会を避ける。
    _managerBrowse = null;
    // 初期化中に開いた候補は、同じ表示条件の取得完了を待つ。
    _initialization = null;
    // ロール階層を初期表示にする。
    mode = 'ROLE';
    // モードごとの起点を別々に保持する。
    _modeSelections = {};
    // 表示情報は画面メモリだけに保持する。
    graph = createGraph();
    // 重い配置計算は入力の変更時だけ実行する。
    model = buildView(this.graph, this.mode);
    // 列の参照権限は所属一覧の応答ごとに更新する。
    memberColumns = [];
    // 取得失敗とゼロ件を区別する。
    memberError = '';
    // 所属ユーザーは選択ロールの一ページだけを保持する。
    memberRows = [];
    // ユーザー一覧で選択したロールまたは上司を保持する。
    memberTarget = null;
    // 前ページへの移動には取得位置だけを保持する。
    memberPositions = [0];
    // 現在のユーザーページを保持する。
    memberIndex = 0;
    // 続きの取得位置は成功した応答だけから確定する。
    memberNextIndex = 0;
    // ユーザー一覧だけの標準カーソルを保持する。
    memberPaginationCursor = null;
    // 一覧と同じ標準カーソルの件数だけをページ表示へ使用する。
    memberTotalCount = null;
    // 標準カーソルの取得上限を案内する。
    memberNotice = '';
    // 同じ一覧への重複したページ操作を止める。
    memberLoading = false;
    // 古いページ取得の完了で読み込み状態を解除しない。
    _memberToken = null;
    // 権限を取得するまで操作を開始しない。
    capabilities = null;
    // 固定メッセージだけを表示する。
    error = '';
    // 候補検索の復旧で構造取得の失敗を消さないよう、表示元を区別する。
    _errorSource = '';
    // 検索入力は画面遷移後も保持する。
    term = '';
    // 可視検索結果だけを画面メモリに保持する。
    results = [];
    // 初期状態と検索結果なしを区別する。
    searched = false;
    // 検索要求の状態を部品へ通知する。
    searching = false;
    // モード変更後の古い応答を無効にする。
    _generation = 0;
    // 同じ範囲の要求順序を管理する。
    _sequences = new Map();
    // 実際のネットワーク並列数を制限する。
    _active = 0;
    // 実行待ちの要求を保持する。
    _queue = [];
    // 要求の相関キーを画面内で一意にする。
    _serial = 0;
    // 新しい検索入力が来た場合に旧候補の反映を止める。
    _lookupToken = null;
    // 入力確定前の検索をまとめる。
    _searchTimer;
    // 構造の一括取得と取り消しを要求単位で管理する。
    _structureToken = null;
    // 画面終了後に状態を書き戻さない。
    _disposed = false;

    // 最初の表示だけ権限と起点を確認する。
    connectedCallback() {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 同じ要素の再接続でも新しい要求を受け付ける。
            this._disposed = false;
            // 既存の認証状態で初期表示を読み込む。
            this.initialize();
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'connectedCallback', 'lifecycle');
        }
    }
    // 保留検索を画面終了後に送らない。
    disconnectedCallback() {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 遅延処理を停止する。
            clearTimeout(this._searchTimer);
            // 実行済み要求の応答を無効にする。
            this._disposed = true;
            // すべての範囲を古い世代にする。
            this._generation += 1;
            // 未送信の要求を解放する。
            this.pump();
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'disconnectedCallback', 'lifecycle');
        }
    }
    // 要求の対応をログイン情報なしで識別する。
    requestId() {
        // 単調増加の番号で衝突を避ける。
        this._serial += 1;
        // サーバーの許可文字だけを使用する。
        return `oe-${Date.now()}-${this._serial}`;
    }
    // 画面条件を切り替える際に全カーソルを破棄する。
    resetContext() {
        // 未完了の応答を表示から切り離す。
        this._generation += 1;
        // 前の条件で始めた構造の取得を止める。
        this._structureToken = null;
        // 表示条件が異なる古い上司候補を再利用しない。
        this._managerBrowse = null;
        // 表示条件を切り替えるとメンバー一覧も初期化する。
        this.resetMembers();
        // 前回の失敗表示を消す。
        this.error = '';
        // 表示条件の変更では前のエラー元も破棄する。
        this._errorSource = '';
        // 空の可視集合へ切り替える。
        this.applyGraph(createGraph());
    }
    // 各APIを同じ並列数と世代チェックで実行する。
    request(scope, action, payload) {
        // この範囲の最新要求番号を確定する。
        const sequence = (this._sequences.get(scope) || 0) + 1;
        // 後から来た要求を優先する。
        this._sequences.set(scope, sequence);
        // 要求を作成した表示条件を固定する。
        const generation = this._generation;
        // 待機中にも呼び出し元が結果を待てるようにする。
        return new Promise((resolve, reject) => {
            // リクエスト全体を待機列へ登録する。
            this._queue.push({ scope, action, payload, sequence, generation, resolve, reject });
            // 空きがある要求だけを送信する。
            this.pump();
        });
    }
    // キューを使って実際のAPI同時送信を二つに抑える。
    pump() {
        // モード変更後も送信済み要求の完了を待つ。
        while (this._active < 2 && this._queue.length) {
            // 順序を保って未送信の要求を取り出す。
            const task = this._queue.shift();
            // 古い検索やモードの要求を送らない。
            if (
                this._disposed ||
                task.generation !== this._generation ||
                task.sequence !== this._sequences.get(task.scope)
            ) {
                // 呼び出し元の待機を安全に終える。
                task.resolve(null);
                // 次の要求を確認する。
                continue;
            }
            // 送信から完了まで同時実行枠を保持する。
            this._active += 1;
            // APIの失敗も同じ完了処理へ流す。
            Promise.resolve()
                .then(() => task.action({ request: task.payload }))
                .then(
                    (response) => {
                        // 古い応答を呼び出し元へ渡さない。
                        task.resolve(this.isCurrentRequest(task) ? response : null);
                    },
                    (error) => {
                        // Apexの公開例外は現在の要求だけに通知する。
                        if (this.isCurrentRequest(task)) task.reject(error);
                        else task.resolve(null);
                    }
                )
                .finally(() => {
                    // 世代変更では送信枠を早期解放しない。
                    this._active -= 1;
                    // 次に待機している要求を送る。
                    this.pump();
                });
        }
    }
    // 成功と失敗で同じ世代・送信順の条件を適用する。
    isCurrentRequest(task) {
        return !this._disposed && task.generation === this._generation && task.sequence === this._sequences.get(task.scope);
    }
    // Apexが公開したメッセージだけを取得元に対応付けて表示する。
    showRequestError(error, source = 'structure') {
        // 候補検索の失敗で構造取得の失敗を上書きしない。
        if (source === 'lookup' && this.error && this._errorSource !== 'lookup') return;
        this._errorSource = source;
        this.error = `${error?.body?.message || '通信に失敗しました。更新してお試しください。'} 表示条件を切り替えて再取得してください。`;
    }
    // 現在の成功応答だけを反映し、同じ取得元の失敗を解除する。
    accepted(response, source = 'structure') {
        if (!response) return false;
        if (this._errorSource === source) {
            this.error = '';
            this._errorSource = '';
        }
        return true;
    }
    // 初期化と更新では権限を再評価する。
    initialize() {
        // 旧入力のタイマー・要求・候補を同時に破棄する。
        this.resetLookup();
        // モードとフィルターに属する状態を初期化する。
        this.resetContext();
        // 候補検索が構造取得の完了を同じ要求で確認できるよう共有する。
        this._initialization = this.loadContext();
        // 接続時と条件変更時で同じ準備完了を返す。
        return this._initialization;
    }
    // 権限と初期値の解決後に、現在の表示条件の構造を取得する。
    async loadContext() {
        const generation = this._generation;
        try {
            // 相関キーだけを送り、各モードの利用可否を取得する。
            const response = await this.request('capabilities', getCapabilities, this.requestId());
            // 読み取り権限を確認できた場合だけ表示を進める。
            if (!this.accepted(response)) return;
            // 現在の権限を画面操作へ反映する。
            this.capabilities = response;
            // 選択中のモードを利用できない場合は構造取得へ進めない。
            if (this.mode === 'ROLE' ? !response.roleModeEnabled : !response.managerModeEnabled) {
                // 別のモードへ自動で切り替えて権限不足を隠さない。
                this.error =
                    this.mode === 'ROLE'
                        ? 'ロールを表示するための参照権限がありません。'
                        : '上司階層を表示するための参照権限がありません。';
                // 許可のない構造照会を行わない。
                return;
            }
            // 初期値の解決に失敗した場合は、構造取得へ進まない。
            if (this.mode === 'ROLE' && !this._rootInitialized && !(await this.initializeDefaultRole())) return;
            // 選択済みの起点だけを再検証して表示する。
            await this.loadStructure();
        } catch (error) {
            if (generation === this._generation && !this._disposed) {
                // 現在の要求の失敗だけを診断表示
                this.reportClientError(error, 'loadContext', 'processing');
                this.showRequestError(error);
            }
        }
    }
    // 設定された初期ロールを一度だけ選択し、未設定・未存在なら空欄で開始する。
    async initializeDefaultRole() {
        // 初期値の有無はこの設定だけで切り替える。
        const developerName = this.defaultRootRoleApiName?.trim() || '';
        // 空欄なら照会を省き、未選択の表示範囲へ揃える。
        let role = null;
        if (developerName) {
            // 組織間で変わるIDではなくAPI名の完全一致で解決する。
            const response = await this.request('role-default', searchRoles, {
                requestId: this.requestId(),
                term: '',
                developerName
            });
            // 通信失敗と古い応答を、初期値なしとして確定しない。
            if (!this.accepted(response)) return false;
            // 存在しない・参照できない場合は空欄を維持する。
            role = response.nodes.length === 1 ? lookupCandidate(response.nodes[0]) : null;
        }
        // 表示範囲とルックアップを同じ初期選択へ揃える。
        this.rootTarget = role;
        this.candidateTarget = role;
        this.term = role?.label || '';
        // 切り替えや再取得で初期値を繰り返し適用しない。
        this._rootInitialized = true;
        return true;
    }
    // データの変更時だけ配置と表示モデルを再生成する。
    applyGraph(graph) {
        // 元の表示状態を確定する。
        this.graph = graph;
        // 取得済みの親子関係から組織図を配置する。
        this.model = buildView(graph, this.mode, this.capabilities?.cardFieldLabels);
    }
    // 起点は検索候補の選択後にも現在の可視性で再確認する。
    async loadStructure() {
        // 全取得が完了するまで部分的な構造を描画しない。
        const token = Symbol('structure');
        this._structureToken = token;
        const state = { token, generation: this._generation, nodes: {}, cursors: new Set() };
        try {
            // 深さや末端数によらず件数単位で取得する。
            await this.loadStructurePage(state, '');
        } catch (error) {
            if (this._structureToken === token && state.generation === this._generation && !this._disposed) {
                // 現在の要求の失敗だけを診断表示
                this.reportClientError(error, 'loadStructure', 'processing');
                this.showRequestError(error);
            }
        } finally {
            // 古い要求から新しいスピナーを解除しない。
            if (this._structureToken === token) this._structureToken = null;
        }
    }
    // 1000件単位の構造ページを結合し、最終ページで部分木を構築する。
    async loadStructurePage(state, cursor) {
        // 起点・表示条件が変わった後は継続しない。
        if (state.generation !== this._generation || this._structureToken !== state.token || this._disposed) return;
        const response = await this.request('structure', getPage, {
            requestId: this.requestId(),
            mode: this.mode,
            scope: this.mode === 'ROLE' ? 'ROLE_STRUCTURE' : 'MANAGER_STRUCTURE',
            parentId: this.rootTarget?.targetId || null,
            includeInactive: this.includeInactive,
            cursor
        });
        // 古い応答や取得失敗を部分木へ統合しない。
        if (!this.accepted(response) || this._structureToken !== state.token) return;
        // 表示モデルへ公開していない取得中の索引だけにページ分を追加する。
        Object.assign(state.nodes, structurePageNodes(response));
        if (response.hasMore) {
            // 不正な継続値で同じページを無限取得しない。
            if (!response.nextCursor || state.cursors.has(response.nextCursor)) {
                this.error = '階層構造の続きの取得位置が不正です。表示条件を切り替えて再取得してください。';
                return;
            }
            state.cursors.add(response.nextCursor);
            await this.loadStructurePage(state, response.nextCursor);
            return;
        }
        // 表示用の部分木へ絞る前に全階層の上位候補だけを確定する。
        if (this.mode === 'MANAGER') this._managerBrowse = managerBrowseCandidates(state.nodes);
        // 指定時は配下、未指定時は全ロールの親子を接続する。
        const graph = createStructureGraph(state.nodes, this.rootTarget?.targetId, this.mode === 'ROLE' ? 'ROLE' : 'USER');
        if (!graph) {
            this.error =
                this.mode === 'ROLE'
                    ? '指定したロールを表示できません。表示対象を選択し直してください。'
                    : '指定した上司を表示できません。表示対象を選択し直してください。';
            return;
        }
        // 表示条件の変更で選択を解除した新しい構造を適用する。
        this.applyGraph(graph);
    }
    // カードの選択を一か所で更新する。
    handleSelect(event) {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 選択キーを表示集合から確認する。
            const key = event.detail.key;
            // イベントから未知のノードを追加しない。
            if (!this.graph.nodes[key]) return;
            // 同じ対象の再クリックではページ位置を維持し、失敗時だけ再試行を許可する。
            if (this.graph.selectedKey === key && this.memberTarget?.key === key && !this.memberError) return;
            // 選択だけでは構造の配置をやり直さず、表示中の座標と線を維持する。
            this.graph = { ...this.graph, selectedKey: key };
            // 新旧の選択カードのハイライトと読み上げ情報だけを更新する。
            this.model = selectView(this.model, key);
            // 前の対象に属する一覧と未完了の応答を破棄する。
            this.resetMembers();
            // ユーザー一覧の起点を選択したロールへ切り替える。
            this.memberTarget =
                this.graph.nodes[key].kind === 'ROLE' || (this.mode === 'MANAGER' && this.graph.nodes[key].kind === 'USER')
                    ? this.graph.nodes[key]
                    : null;
            // 権限不足をユーザーなしと誤認させない。
            this.memberError = this.membersEnabled ? '' : 'ユーザー一覧を参照する権限がありません。';
            // ユーザー参照が可能な場合だけ所属一覧を照会する。
            if (this.memberTarget && this.membersEnabled) this.loadMemberPage(0, 0);
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleSelect', 'ui-event');
        }
    }
    // 表示条件変更とカード選択で同じメンバー初期状態へ戻す。
    resetMembers() {
        // 古い応答の適用と読み込み状態の書き戻しを止める。
        this._memberToken = null;
        // 次の要求が始まるまでは読み込み状態を解除する。
        this.memberLoading = false;
        // 前の対象に対するページ操作を止める。
        this.memberTarget = null;
        // 別の対象のメンバーを表示し続けない。
        this.memberRows = [];
        // 列の参照権限は次の応答で確定する。
        this.memberColumns = [];
        // 前の対象の取得失敗を引き継がない。
        this.memberError = '';
        // 条件が異なる標準カーソルを再利用しない。
        this.memberPaginationCursor = null;
        // 新しい結果集合は必ず先頭から取得する。
        this.memberPositions = [0];
        // ページ番号も先頭へ戻す。
        this.memberIndex = 0;
        // 前の対象の次ページ位置を破棄する。
        this.memberNextIndex = 0;
        // 件数は次の応答で確定する。
        this.memberTotalCount = null;
        // 前の一覧の上限案内を残さない。
        this.memberNotice = '';
    }
    // 所属一覧は組織図へ統合せず50件単位で取得する。
    async loadMemberPage(startIndex, index) {
        // 対象ロールがない操作や重複クリックを送らない。
        if (!this.memberTarget || this.memberLoading) return;
        // ページ取得中に別のロールへ切り替わる場合へ備える。
        const role = this.memberTarget;
        // 要求単位で読み込み中の状態を識別する。
        const token = Symbol('members');
        // 最新のページ取得を記録する。
        this._memberToken = token;
        // 取得中は前後ページの操作を止める。
        this.memberLoading = true;
        // 再試行時に前の失敗を消す。
        this.memberError = '';
        // 再取得中に旧権限の項目を表示しない。
        this.memberRows = [];
        // 応答で列権限を再確定する。
        this.memberColumns = [];
        // 失敗や読み込み中に前の上限案内を残さない。
        this.memberNotice = '';
        // 失敗した場合も現在の要求だけを終了する。
        let response;
        try {
            // サーバーはロールと利用者権限を毎回確認する。
            response = await this.request('members', getPage, {
                requestId: this.requestId(),
                mode: this.mode,
                scope: this.mode === 'ROLE' ? 'ROLE_MEMBERS' : 'MANAGER_MEMBERS',
                parentId: role.recordId,
                includeInactive: this.includeInactive,
                paginationCursor: this.memberPaginationCursor,
                startIndex
            });
            // 別ロールや旧ページの応答を一覧へ混ぜない。
            if (this._memberToken !== token || this.memberTarget?.key !== role.key) return;
            // 失敗をゼロ件として表示しない。
            if (!response) return;
            // 可視確認済みのIDだけから標準URLを生成する。
            const urls = await this.createMemberUrls(response.nodes);
            // URL生成中のロール変更や画面終了後の応答を適用しない。
            if (this._memberToken !== token || this.memberTarget?.key !== role.key || this._disposed) return;
            // サーバーが許可した列だけを表示する。
            this.memberColumns = memberColumns(response.memberColumns, response.memberColumnLabels);
            // 一覧は追加でなく一ページ分へ置換する。
            this.memberRows = memberView(response.nodes, urls);
            // 成功してからページ位置を進める。
            this.memberIndex = index;
            // 戻る操作には各ページの開始位置だけを保存する。
            this.memberPositions = [...this.memberPositions.slice(0, index), startIndex];
            // 初回応答の標準カーソルを前後ページで共有する。
            this.memberPaginationCursor = response.paginationCursor;
            // 構造取得後の人数変更も一覧の結果集合に合わせる。
            this.memberTotalCount = response.memberTotalCount;
            // 取得上限の案内は成功した応答だけから反映する。
            this.memberNotice = response.memberNotice || '';
            // 続きがある場合だけ次へ操作を可能にする。
            this.memberNextIndex = response.hasMore ? response.nextIndex : 0;
        } catch (error) {
            // 旧ロールの失敗を新しい一覧へ表示しない。
            if (this._memberToken === token && !this._disposed) {
                // 例外本文を記録せず、失敗した処理だけを通知
                this.reportClientError(error, 'loadMemberPage', 'processing');
                // 生のナビゲーションエラーを公開しない。
                this.memberError = error?.body?.message || (response
                    ? 'メンバーのリンクを生成できませんでした。対象を選択し直してください。'
                    : '所属ユーザーを取得できませんでした。通信状態を確認して再試行してください。');
                // 前のページ境界を再利用しない。
                this.memberNextIndex = 0;
            }
        } finally {
            // 旧応答から新しい取得中表示を解除しない。
            if (this._memberToken === token) this.memberLoading = false;
        }
    }
    // 一ページで必要なユーザープロフィールURLをまとめて生成する。
    async createMemberUrls(nodes) {
        // 重複する関連先は同じURLを共有する。
        const entries = await Promise.all(
            memberProfileIds(nodes).map(async (id) => {
                // URLの生成は標準のナビゲーションAPIへ委ねる。
                const url = await this[NavigationMixin.GenerateUrl](userProfileReference(id));
                // 行ごとの対応を保持して返却する。
                return [id, url];
            })
        );
        // 生成結果は現在のページだけで利用し永続保存しない。
        return Object.fromEntries(entries);
    }
    // 一覧の前後移動は現在のロール内だけで行う。
    handleMemberPage(event) {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 固定された方向だけを受け付ける。
            const next = event.currentTarget.dataset.direction === 'next';
            // 取得前の画面番号は変更しない。
            const index = this.memberIndex + (next ? 1 : -1);
            // 初回より前や続きなしの操作を送らない。
            if (index < 0 || (next && !this.memberNextIndex)) return;
            // 戻る際も一覧情報を再取得する。
            this.loadMemberPage(next ? this.memberNextIndex : this.memberPositions[index], index);
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleMemberPage', 'ui-event');
        }
    }
    // 一覧の見出しに現在の選択対象と参照可能な役職を表示する。
    get memberTargetLabel() {
        // ロール名は維持し、上司の場合だけ役職を補足する。
        return memberSelectionLabel(this.memberTarget, this.mode);
    }
    // 一覧が空のときはページ操作と番号を表示しない。
    get hasMemberRows() {
        // 表示中の行の有無にページ操作を合わせる。
        return this.memberRows.length > 0;
    }
    // 前ページがない場合や取得中は操作を無効にする。
    get memberPreviousDisabled() {
        // 最初のページより前へ移動させない。
        return this.memberLoading || Boolean(this.memberError) || this.memberIndex === 0;
    }
    // 続きがない場合や取得中は操作を無効にする。
    get memberNextDisabled() {
        // 件数の集計なしで継続値から判定する。
        return this.memberLoading || Boolean(this.memberError) || !this.memberNextIndex;
    }
    // ページ番号から推測せず、標準カーソルで取得した実際の開始位置を使う。
    get memberRowNumberOffset() {
        // 前後移動でも同じ行へ同じ通し番号を付ける。
        return this.memberPositions[this.memberIndex] ?? 0;
    }
    // ページ表示は成功した取得位置に対応させる。
    get memberPageLabel() {
        // 一覧の応答件数を使い、構造の取得時点との差を持ち込まない。
        return memberPageLabel(this.memberIndex, this.memberTotalCount, Boolean(this.memberNextIndex));
    }
    // 古い入力の要求・タイマー・候補表示を一つの状態として解除する。
    resetLookup() {
        // 未送信のデバウンスを破棄する。
        clearTimeout(this._searchTimer);
        // 待機中・送信済みの旧候補を表示へ反映させない。
        this._lookupToken = null;
        // 同じ世代で入力だけ変わる場合も旧要求を無効にする。
        this._sequences.set('lookup', (this._sequences.get('lookup') || 0) + 1);
        // 古い入力の結果を次の候補操作へ持ち越さない。
        this.results = [];
        // 上限案内と空結果表示を未検索へ戻す。
        this.lookupHasMore = false;
        // 次の応答が届くまで候補なしと確定しない。
        this.searched = false;
        // 取り消した要求の読み込み状態を終了する。
        this.searching = false;
    }
    // 名前で候補を絞り、空欄への変更は全体表示へ反映する。
    handleSearchChange(event) {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 未確定の入力を適用済みの起点から分離する。
            this.term = event.detail.value;
            // 手入力した名称だけでは起点として扱わない。
            this.candidateTarget = null;
            // 空欄への変更は表示条件の初期化と一緒に候補を取り消す。
            if (!this.term.trim()) {
                this.applyTargetSelection();
                return;
            }
            // 同じ表示範囲でも旧入力に属する要求と結果を破棄する。
            this.resetLookup();
            // 入力が確定するまで候補検索をまとめる。
            // eslint-disable-next-line @lwc/lwc/no-async-operation -- 入力確定を300ms待ち、入力変更・破棄時に解除する
            this._searchTimer = setTimeout(() => this.lookupTargets(), 300);
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleSearchChange', 'ui-event');
        }
    }
    // クリック時は入力状態に応じた候補をすぐに取得する。
    handleLookupOpen(event) {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 選択解除時のデバウンスとフォーカス要求を重複させない。
            clearTimeout(this._searchTimer);
            // 同じ候補を取得中は二重送信しない。
            if (!this.searching) this.lookupTargets(event.detail?.browse ? '' : this.term.trim());
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleLookupOpen', 'ui-event');
        }
    }
    // 未入力は上位階層から、入力時は名称の前方一致で候補を取得する。
    async lookupTargets(searchTerm = this.term) {
        // 前後空白を検索条件から除く。
        const term = searchTerm.trim();
        // 過長な名称と権限未確認の要求を送らない。
        if (
            term.length > 80 ||
            !(this.mode === 'ROLE' ? this.capabilities?.roleModeEnabled : this.capabilities?.managerModeEnabled)
        )
            return;
        // 旧世代の応答を表示しないため記録する。
        const generation = this._generation;
        // 同じ入力で再度開いた場合も一つの探索だけを有効にする。
        const token = Symbol('lookup');
        // 最新の論理要求を記録する。
        this._lookupToken = token;
        // 候補要求全体の間は読み込み中と通知する。
        this.searching = true;
        // 中断や失敗でも最新要求だけが読み込み表示を解除する。
        try {
            // 空欄は最上位だけ、入力時は全階層の名称候補を一回で取得する。
            await this.loadLookupCandidates({ term, generation, token });
        } catch (error) {
            if (generation === this._generation && this._lookupToken === token && !this._disposed) {
                // 例外本文を記録せず、失敗した処理だけを通知
                this.reportClientError(error, 'lookupTargets', 'processing');
                this.showRequestError(error, 'lookup');
                this.resetLookup();
            }
        } finally {
            // 古い探索で新しい要求のスピナーを解除しない。
            if (this._lookupToken === token) this.searching = false;
        }
    }
    // 候補の取得後に入力変更や中断を確認する。
    async loadLookupCandidates(state) {
        // 一つの論理要求の条件を引き継ぐ。
        const { term, generation, token } = state;
        // 未入力の上司候補は現在の権限・有効条件で取得済みの構造を使う。
        if (this.mode === 'MANAGER' && !term) {
            // 読み込み中を候補なしと確定せず、全ページの取得完了を待つ。
            await this._initialization;
            // 待機中に変更・解除された条件や失敗した構造の候補を公開しない。
            if (
                generation !== this._generation ||
                this._lookupToken !== token ||
                this._disposed ||
                !this._managerBrowse
            )
                return;
            // 上位からの候補を追加の通信なしで表示する。
            this.results = this._managerBrowse.results;
            // 続きは氏名による絞り込みを促す。
            this.lookupHasMore = this._managerBrowse.hasMore;
            // 空集合も取得済みの候補として扱う。
            this.searched = true;
            return;
        }
        // ロールの空欄候補と氏名の前方一致はサーバーで検索する。
        const response = await this.request(
            'lookup',
            this.mode === 'ROLE' ? searchRoles : searchManagers,
            this.mode === 'ROLE'
                ? { requestId: this.requestId(), term, developerName: '' }
                : { requestId: this.requestId(), term, activityFilter: this.includeInactive ? 'ALL' : 'ACTIVE' }
        );
        // 入力変更・モード変更・後続要求後の結果を使用しない。
        if (generation !== this._generation || this._lookupToken !== token || !response) return;
        this.accepted(response, 'lookup');
        // 空欄時の子階層探索を行わず、一回の応答をそのまま候補にする。
        this.results = response.nodes.map(lookupCandidate);
        // 候補が上限を超えた場合は名前の入力を促す。
        this.lookupHasMore = response.hasMore;
        // 空候補も取得完了として区別する。
        this.searched = true;
    }
    // 可視な候補の確定と同時に表示範囲を切り替える。
    handleTargetPick(event) {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 可視な候補以外のIDを受け付けない。
            const target = this.results.find((item) => item.targetId === event.detail.targetId);
            // 古い候補の操作を捨てる。
            if (!target) return;
            // 選択したIDと名称を保持する。
            this.candidateTarget = target;
            // 確定した名称を入力へ表示する。
            this.term = target.label;
            // 選択された値をそのまま表示範囲へ適用する。
            this.applyTargetSelection();
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleTargetPick', 'ui-event');
        }
    }
    // 候補の選択と解除から、確定した表示範囲を適用する。
    applyTargetSelection() {
        // 表示条件として適用する起点を確定する。
        this.rootTarget = this.candidateTarget;
        // 初期設定へ戻さず明示選択を維持する。
        this._rootInitialized = true;

        // 古い描画と応答を破棄して再取得する。
        this.initialize();
    }
    // モードごとの起点を維持し、旧モードの応答を引き継がない。
    handleMode(event) {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 固定された二つのモードだけを受け付ける。
            const mode = event.currentTarget.dataset.mode;
            // 選択済みのモードへ重複照会しない。
            if (mode === this.mode || !['ROLE', 'MANAGER'].includes(mode)) return;
            // 現在の選択をモードごとに退避する。
            this._modeSelections[this.mode] = {
                rootTarget: this.rootTarget,
                candidateTarget: this.candidateTarget,
                term: this.term,
                initialized: this._rootInitialized
            };
            // 新しいモードの初期値はログインユーザーに固定しない。
            const saved = this._modeSelections[mode];
            // 全体の表示条件を切り替える。
            this.mode = mode;
            // 前モードの候補を起点として使用しない。
            this.rootTarget = saved?.rootTarget || null;
            // 選択済みのルックアップ表示を復元する。
            this.candidateTarget = saved?.candidateTarget || null;
            // 名称入力もモードごとに維持する。
            this.term = saved?.term || '';
            // 上司階層には初期ロールの解決処理を適用しない。
            this._rootInitialized = mode === 'MANAGER' || Boolean(saved?.initialized);
            // 取得と描画を新しい世代で開始する。
            this.initialize();
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleMode', 'ui-event');
        }
    }
    // モードに応じたユーザー一覧の権限を確認する。
    get membersEnabled() {
        // 上司階層にはロール所属の参照権限を要求しない。
        return this.mode === 'ROLE' ? this.capabilities?.roleMembersEnabled : this.capabilities?.managerModeEnabled;
    }
    // ユーザー一覧の内容を読み上げにも反映する。
    get memberListLabel() {
        // 両モードで共通の一覧名称を使う。
        return 'メンバー';
    }
    // ページ移動の読み上げ対象をモードへ合わせる。
    get memberPagingLabel() {
        // 一覧の対象名称を共用する。
        return `${this.memberListLabel}のページ操作`;
    }
    // 起点ルックアップの対象を明示する。
    get lookupSectionLabel() {
        // ロール選択と上司選択を混同させない。
        return this.mode === 'ROLE' ? '表示ロールを指定' : '表示上司を指定';
    }
    // 上司モードの選択状態を通知する。
    get managerSelected() {
        // 取得モードとボタン表示を一致させる。
        return this.mode === 'MANAGER';
    }
    // 上司項目を参照できない場合は操作を無効にする。
    get managerDisabled() {
        // ロールの参照権限とは独立して評価する。
        return !this.capabilities?.managerModeEnabled;
    }
    // 表示条件の切り替えでも適用済みの起点を維持する。
    handleInactive() {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 有効条件を反転する。
            this.includeInactive = !this.includeInactive;
            // 同じ起点で構造と所属一覧を再取得可能にする。
            this.initialize();
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleInactive', 'ui-event');
        }
    }
    // 表示の拡大縮小と等倍復帰はCanvasへ委ねる。
    handleViewport(event) {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // DOM操作をLogicへ渡さない。
            const canvas = this.template.querySelector('c-org-explorer-canvas');
            // 描画されてから操作する。
            if (!canvas) return;
            // 固定された操作だけを受け付ける。
            const action = event.currentTarget.dataset.action;
            // 中央を保って倍率を上げる。
            if (action === 'in') canvas.adjustZoom(0.15);
            // 中央を保って倍率を下げる。
            else if (action === 'out') canvas.adjustZoom(-0.15);
            // 可視集合全体を表示枠へ収める。
            else if (action === 'fit') canvas.fit();
            // 最上位ロールを上部中央へ配置して等倍へ戻す。
            else if (action === 'reset') canvas.resetZoom();
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'handleViewport', 'ui-event');
        }
    }
    // 送信済みの処理があることを通知する。
    get busy() {
        // 保留中の操作でも画面を全面ロックしない。
        return this._active > 0 || this._structureToken !== null;
    }
    // ロール階層の注意書きを切り替える。
    get roleSelected() {
        // ロール構造を上司関係と混同しない。
        return this.mode === 'ROLE';
    }
    // ロール構造の権限を独立して評価する。
    get roleDisabled() {
        // User参照だけではロールモードを有効化しない。
        return !this.capabilities?.roleModeEnabled;
    }
    // 子の非同期描画は例外境界へ自動伝播しないため、診断だけを受け取る
    handleCanvasError(event) {
        // DOMイベントの内容をそのまま記録せず、固定処理名で再構成
        try {
            // 位置情報は共通処理で再抽出して本文やURLの混入を防ぐ
            const error = { name: event.detail?.errorType, stack: `Error\n${(event.detail?.frames || []).join('\n')}` };
            // 子の処理名は既知の操作だけを受け付け、値や本文を混入させない
            const locations = {
                'orgExplorerCanvas.js / renderedCallback / model-validation': ['描画データの検証', 'model-validation'],
                'orgExplorerCanvas.js / handlePointerDown / pointer-capture': ['ドラッグ開始', 'pointer-capture'],
                'orgExplorerCanvas.js / handlePointerDown / pointer-event': ['ドラッグ開始', 'pointer-event'],
                'orgExplorerCanvas.js / handlePointerMove / animation-request': ['移動描画の予約', 'animation-request'],
                'orgExplorerCanvas.js / handlePointerMove / animation-frame': ['移動描画', 'animation-frame'],
                'orgExplorerCanvas.js / handlePointerMove / pointer-event': ['ドラッグ移動', 'pointer-event'],
                'orgExplorerCanvas.js / cancelPendingFrame / animation-cancel': ['移動描画の取消', 'animation-cancel'],
                'orgExplorerCanvas.js / handlePointerLeave / pointer-capture': ['ドラッグ終了', 'pointer-capture'],
                'orgExplorerCanvas.js / handleWheel / pointer-event': ['ホイール拡大・縮小', 'pointer-event']
            };
            // 旧版の子部品は従来の非同期描画エラーとして扱う
            const [operation, phase] = locations[event.detail?.location] || ['orgExplorerCanvas.handlePointerMove', 'animation-frame'];
            // 圧縮後の行番号ではなく失敗した操作を特定できるよう表示する
            const code = new Set(['ORG-JS-DOM-TARGET', 'ORG-JS-MODEL', 'ORG-JS-UNEXPECTED']).has(event.detail?.code) ? event.detail.code : 'ORG-JS-UNEXPECTED';
            // 子から渡された自由文ではなく固定コードの理由だけを表示する
            this.reportClientError(error, operation, phase, code);
        } catch (boundaryError) {
            // 不正な通知形式も画面内で捕捉
            this.reportClientError(boundaryError, 'handleCanvasError', 'child-component');
        }
    }
}
