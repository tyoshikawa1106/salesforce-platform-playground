import { createClientErrorDetails } from 'c/errorUtils';
import { LightningElement, api } from 'lwc';
import { BASE_SCALE, isCanvasModel, alignRoot, zoomAt, panTo, clamp } from './orgExplorerCanvasLogic';

// 組織図の描画と、取得処理から独立した表示位置の操作を担当する。
export default class OrgExplorerCanvas extends LightningElement {
    // 不正データや別の対象の古い図をテンプレートへ渡さない。
    _model = { rows: [], edges: [], width: 600, height: 420, countText: '表示ロール数：0' };
    // 親の描画中には診断を送らず、子の描画完了時に一度通知する。
    modelIssue = false;

    @api
    get model() { return this._model; }
    set model(value) {
        // 必要な構造だけを判定し、値そのものは診断へ公開しない。
        this.modelIssue = !isCanvasModel(value);
        // 不正な応答は正常なゼロ件と扱わず、空の図と診断を表示する。
        this._model = this.modelIssue ? { rows: [], edges: [], width: 600, height: 420, countText: '描画できません' } : value;
    }
    // 閲覧位置はブラウザメモリ内だけに保持する。
    viewport = { x: 0, y: 0, scale: BASE_SCALE };
    // 起点が変わった場合だけ初期位置へ戻す。
    _rootKey = '';
    // ドラッグの一時情報を保持する。
    pointer = null;
    // 描画更新をフレーム単位にまとめる。
    frame = null;
    // 取消APIが使えない環境でも古いコールバックを無効化する。
    frameVersion = 0;

    // 線とカードに同じ座標変換を適用する。
    get planeStyle() {
        // 計算済み数値だけをスタイルへ使用する。
        return `width:${this.model.width}px;height:${this.model.height}px;transform:translate(${this.viewport.x}px,${this.viewport.y}px) scale(${this.viewport.scale});`;
    }

    // 現在の倍率を読み上げ可能にする。
    get zoomLabel() {
        // UIには倍率を百分率で表示する。
        return `${Math.round((this.viewport.scale / BASE_SCALE) * 100)}%`;
    }

    // 新しい起点の初期位置だけを整え、利用者の倍率を保持する。
    renderedCallback() {
        // 不正なモデルはTypeErrorになる前に具体的な固定理由で通知する。
        if (this.modelIssue) {
            this.modelIssue = false;
            this.reportCanvasError(new TypeError(), 'renderedCallback', 'model-validation', 'ORG-JS-MODEL');
            return;
        }
        // 選択中の子ではなく、現在の最上位ノードを確認する。
        const root = this.model.rows.find((row) => row.kind === 'ROLE' && row.depth === 0) || this.model.rows[0];
        // 空状態で起点の記録も解除し、同じ条件の再取得に備える。
        if (!root) this._rootKey = '';
        // 新しい起点だけを100%の上部中央へ配置する。
        if (root && this._rootKey !== root.key) {
            // スクロールや再描画で初期位置へ戻らないよう記録する。
            this._rootKey = root.key;
            // 全体表示は手動ボタンからだけ実行する。
            this.resetZoom();
        }
    }

    // 処理中のフレームを破棄して切断後の更新を防ぐ。
    disconnectedCallback() {
        // 自分で予約したフレームだけを取り消す。
        this.cancelPendingFrame();
        // 再接続後に取り消し済みの予約を引き継がない。
        this.frame = null;
        // 切断中に終了したドラッグを再開しない。
        this.pointer = null;
    }

    // 拡大・縮小を親の操作からも利用できるようにする。
    @api
    adjustZoom(delta) {
        // 未描画のドラッグ位置を先に確定し、倍率変更の後から上書きしない。
        this.handlePointerUp();
        // 現在表示している領域の寸法を確認する。
        const bounds = this.getBounds();
        // 中央を基準として倍率を変更する。
        this.viewport = zoomAt(this.viewport, this.viewport.scale + delta * BASE_SCALE, {
            x: bounds.width / 2,
            y: bounds.height / 2
        });
    }

    // 表示中の範囲だけに合わせて全体を確認する。
    @api
    fit() {
        // 保留中の移動を終了してから全体表示の位置を確定する。
        this.handlePointerUp();
        // 非表示の組織全体の寸法は計算しない。
        const bounds = this.getBounds();
        // 読めないほど小さな倍率にしない。
        const scale = clamp(
            Math.min(bounds.width / this.model.width, bounds.height / this.model.height),
            BASE_SCALE * 0.25,
            BASE_SCALE
        );
        // 現在の表示領域へ合わせる。
        this.viewport = { scale, x: (bounds.width - this.model.width * scale) / 2, y: 0 };
    }

    // 選択中の子ではなく最上位ロールを上部中央に置いて等倍へ戻す。
    @api
    resetZoom() {
        // ドラッグ予約を残さず等倍復帰の位置を優先する。
        this.handlePointerUp();
        // 上司階層では先頭の起点を使用する。
        const root = this.model.rows.find((row) => row.kind === 'ROLE' && row.depth === 0) || this.model.rows[0];
        // 空状態でも等倍へ戻し、不明な座標では移動しない。
        this.viewport = alignRoot(root, this.getBounds());
    }

    // カードの選択と背景ドラッグを区別する。
    handlePointerDown(event) {
        try {
            // DOM機能の存在を使用直前に確認し、推測ではなく理由を通知する。
            if (typeof event.target?.closest !== 'function') {
                this.reportCanvasError(new TypeError(), 'handlePointerDown', 'pointer-event', 'ORG-JS-DOM-TARGET');
                return;
            }
            // カード操作ではパンを開始しない。
            if (event.button !== 0 || event.target.closest('c-org-explorer-card')) return;
            // 背景上の文字選択を開始しない。
            event.preventDefault();
            // pointerが領域外へ出ても終了を検知する。
            try {
                // セキュリティ設定によって公開されない環境では領域内ドラッグを使用する。
                event.currentTarget.setPointerCapture?.(event.pointerId);
            } catch (error) {
                // 取得できない場合も領域外へ出た時点で終了する代替操作を継続する。
                if (error?.name !== 'TypeError' && error?.name !== 'NotFoundError' && error?.name !== 'NotSupportedError') { this.reportCanvasError(error, 'handlePointerDown', 'pointer-capture'); }
            }
            // 開始座標と表示位置を保持する。
            this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, viewport: this.viewport };

        } catch (error) {
            // 子の操作失敗を標準エラーページへ伝播させない。
            this.reportCanvasError(error, 'handlePointerDown', 'pointer-event');
        }
    }

    // 高頻度の移動を一フレームの表示更新へまとめる。
    handlePointerMove(event) {
        try {
            // ドラッグ中のpointer以外を処理しない。
            if (!this.pointer || this.pointer.id !== event.pointerId) return;
            // 最後のpointer位置を保持する。
            const x = event.clientX - this.pointer.x + this.pointer.viewport.x;
            // 開始時点を基準に差分を計算する。
            const y = event.clientY - this.pointer.y + this.pointer.viewport.y;
            // 終了操作が次の描画より早い場合も最後の移動位置を失わない。
            const position = panTo(this.viewport, { x, y });
            // 終了時に同じ位置を同期反映できるよう保持する。
            this.pointer.position = position;
            // 未実行のフレームを最新位置へ置き換える。
            this.cancelPendingFrame();
            // 任意の描画APIを使えない環境では移動位置を同期反映する。
            if (typeof requestAnimationFrame !== 'function') {
                this.viewport = { ...this.viewport, ...position };
                return;
            }
            // 取消後のコールバックから新しい表示位置を上書きしない。
            const version = this.frameVersion;
            try {
                // 過剰な再描画を避ける。
                // eslint-disable-next-line @lwc/lwc/no-async-operation -- ドラッグ描画をフレーム単位にまとめ、次の移動・破棄時に解除する
                this.frame = requestAnimationFrame(() => {
                    // 取消処理後や切断後の更新を反映しない。
                    if (version !== this.frameVersion) return;
                    // 非同期の描画失敗は親のerrorCallbackへ自動伝播しないため明示的に捕捉
                    try {
                        // 有限の表示位置へ反映する。
                        this.viewport = { ...this.viewport, ...position };
                    } catch (error) {
                        // 本文を含まない診断だけを作成
                        const details = { ...createClientErrorDetails(error, 'orgExplorerCanvas', 'handlePointerMove', 'animation-frame'), code: 'ORG-JS-UNEXPECTED' };
                        // DOMツリーを越えて公開せず、直接の親画面へ失敗を通知
                        this.dispatchEvent(new CustomEvent('clienterror', { detail: details }));
                    } finally {
                        // 成功・失敗とも次の描画予約を可能にする
                        this.frame = null;
                    }
                });
            } catch (error) {
                // 呼出し自体が許可されない環境では予約を残さず同期反映する。
                this.frame = null;
                this.viewport = { ...this.viewport, ...position };
                // APIの利用不可以外の失敗だけを処理位置とともに通知する。
                if (error?.name !== 'TypeError' && error?.name !== 'NotSupportedError') { this.reportCanvasError(error, 'handlePointerMove', 'animation-request'); }
            }

        } catch (error) {
            // 子の操作失敗を標準エラーページへ伝播させない。
            this.reportCanvasError(error, 'handlePointerMove', 'pointer-event');
        }
    }

    // 予約の取消と無効化を同じ順序で行う。
    cancelPendingFrame() {
        // APIの取消結果に依存せず、既存コールバックを無効化する。
        this.frameVersion += 1;
        // 切断や操作終了時に同じ予約を再び取り消さない。
        const frame = this.frame;
        this.frame = null;
        // 取消機能がない場合も世代番号で古い描画を無効化済み。
        if (frame === null || typeof cancelAnimationFrame !== 'function') return;
        try {
            // 対応環境では不要なブラウザ処理も解除する。
            cancelAnimationFrame(frame);
        } catch (error) {
            // 非対応の取消機能を必須条件にしない。
            if (error?.name !== 'TypeError' && error?.name !== 'NotSupportedError') { this.reportCanvasError(error, 'cancelPendingFrame', 'animation-cancel'); }
        }
    }

    // 同期の操作失敗も子画面の処理場所を維持して親へ通知する。
    reportCanvasError(error, operation, phase, code = 'ORG-JS-UNEXPECTED') {
        // 入力値や例外本文を含めず診断情報を生成する。
        const details = { ...createClientErrorDetails(error, 'orgExplorerCanvas', operation, phase), code };
        // 直接の親が既存の画面内エラー表示へ反映する。
        this.dispatchEvent(new CustomEvent('clienterror', { detail: details }));
    }

    // 画面外やキャンセルでもドラッグ状態を解放する。
    handlePointerUp() {
        // 次の操作へドラッグの描画予約を持ち越さない。
        this.cancelPendingFrame();
        // キャンセル済みの予約を次のドラッグで再利用しない。
        this.frame = null;
        // フレーム待ちだった最後の移動も終了位置へ反映する。
        if (this.pointer?.position) this.viewport = { ...this.viewport, ...this.pointer.position };
        // 次のカード操作にドラッグ状態を残さない。
        this.pointer = null;
    }

    // 領域外へ出たときは、捕捉できていないドラッグだけを終了する。
    handlePointerLeave(event) {
        // 捕捉の有無を照会できない環境では安全に移動を確定する。
        try {
            // 対応環境では画面外へ移動したpointerも引き続き追跡する。
            if (event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
        } catch (error) {
            // 捕捉状態を確認できなくてもドラッグを残さない。
            if (error?.name !== 'TypeError') this.reportCanvasError(error, 'handlePointerLeave', 'pointer-capture');
        }
        // 領域外へ出た時点の最後の移動を確定する。
        this.handlePointerUp();
    }

    // ホイールの拡大は明示キー操作時だけ行う。
    handleWheel(event) {
        try {
            // 通常のページスクロールを妨げない。
            if (!event.ctrlKey) return;
            // ホイール操作もドラッグ終了後の位置から拡大する。
            this.handlePointerUp();
            // ブラウザのページ全体の拡大と重複しない。
            event.preventDefault();
            // 領域内のポインタ位置を使用する。
            const rect = event.currentTarget.getBoundingClientRect();
            // 同じ位置を中心に倍率を変更する。
            this.viewport = zoomAt(this.viewport, this.viewport.scale + (event.deltaY < 0 ? 0.1 : -0.1) * BASE_SCALE, {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            });

        } catch (error) {
            // 子の操作失敗を標準エラーページへ伝播させない。
            this.reportCanvasError(error, 'handleWheel', 'pointer-event');
        }
    }

    // DOM計測はLWC側に留め、純粋関数へ要素を渡さない。
    getBounds() {
        // 描画領域だけを参照する。
        const element = this.template.querySelector('.c-viewport');
        // 未描画のテストや初期状態にも有限の寸法を返す。
        return { width: element?.clientWidth || 600, height: element?.clientHeight || 480 };
    }
}
