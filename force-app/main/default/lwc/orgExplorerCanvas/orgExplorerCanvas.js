import { createClientErrorDetails } from 'c/errorUtils';
import { LightningElement, api } from 'lwc';
import { BASE_SCALE, alignRoot, zoomAt, panTo, clamp } from './orgExplorerCanvasLogic';

// 組織図の描画と、取得処理から独立した表示位置の操作を担当する。
export default class OrgExplorerCanvas extends LightningElement {
    @api model = { rows: [], edges: [], width: 600, height: 420, countText: '表示ロール数：0' };
    // 閲覧位置はブラウザメモリ内だけに保持する。
    viewport = { x: 0, y: 0, scale: BASE_SCALE };
    // 起点が変わった場合だけ初期位置へ戻す。
    _rootKey = '';
    // ドラッグの一時情報を保持する。
    pointer = null;
    // 描画更新をフレーム単位にまとめる。
    frame = null;

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
        if (this.frame !== null) cancelAnimationFrame(this.frame);
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
        // カード操作ではパンを開始しない。
        if (event.button !== 0 || event.target.closest('c-org-explorer-card')) return;
        // 背景上の文字選択を開始しない。
        event.preventDefault();
        // pointerが領域外へ出ても終了を検知する。
        event.currentTarget.setPointerCapture(event.pointerId);
        // 開始座標と表示位置を保持する。
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, viewport: this.viewport };
    }

    // 高頻度の移動を一フレームの表示更新へまとめる。
    handlePointerMove(event) {
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
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        // 過剰な再描画を避ける。
        // eslint-disable-next-line @lwc/lwc/no-async-operation -- ドラッグ描画をフレーム単位にまとめ、次の移動・破棄時に解除する
        this.frame = requestAnimationFrame(() => {
            // 非同期の描画失敗は親のerrorCallbackへ自動伝播しないため明示的に捕捉
            try {
                // 有限の表示位置へ反映する。
                this.viewport = { ...this.viewport, ...position };
            } catch (error) {
                // 本文を含まない診断だけを作成
                const details = createClientErrorDetails(error, 'orgExplorerCanvas', 'handlePointerMove', 'animation-frame');
                // DOMツリーを越えて公開せず、直接の親画面へ失敗を通知
                this.dispatchEvent(new CustomEvent('clienterror', { detail: details }));
            } finally {
                // 成功・失敗とも次の描画予約を可能にする
                this.frame = null;
            }
        });
    }

    // 画面外やキャンセルでもドラッグ状態を解放する。
    handlePointerUp() {
        // 次の操作へドラッグの描画予約を持ち越さない。
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        // キャンセル済みの予約を次のドラッグで再利用しない。
        this.frame = null;
        // フレーム待ちだった最後の移動も終了位置へ反映する。
        if (this.pointer?.position) this.viewport = { ...this.viewport, ...this.pointer.position };
        // 次のカード操作にドラッグ状態を残さない。
        this.pointer = null;
    }

    // ホイールの拡大は明示キー操作時だけ行う。
    handleWheel(event) {
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
    }

    // DOM計測はLWC側に留め、純粋関数へ要素を渡さない。
    getBounds() {
        // 描画領域だけを参照する。
        const element = this.template.querySelector('.c-viewport');
        // 未描画のテストや初期状態にも有限の寸法を返す。
        return { width: element?.clientWidth || 600, height: element?.clientHeight || 480 };
    }
}
