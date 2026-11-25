import { getApexMessage, reduceErrors } from 'c/salesforceApiUtils';
import { api } from 'lwc';
import LightningModal from 'lightning/modal';
import { confirmationText } from './setupAuditTrailExportModalLogic';

// 確認、取得進捗、失敗時の再試行を一つの標準モーダル内で扱う。
export default class SetupAuditTrailExportModal extends LightningModal {
    // 項目CSVではオブジェクト名、種類と対象件数を受け取る。
    @api exportSubject;
    // 確認対象の月と期間を呼び出し時点に固定する。
    @api month;
    // 月別、全期間、検索結果のいずれかを受け取る。
    @api period;
    // 適用済みの検索条件を件数と一緒に確認できるようにする。
    @api filters;
    // 呼び出し元の離脱を、モーダルの切断より先にも検知する。
    @api ownerSignal;
    // 一覧と同じ基準時刻、照合方法で件数を確定する。
    @api prepareSelection;
    // 確認後にだけ呼び出し元のページ取得処理を開始する。
    @api buildFile;
    // 確認済みの検索条件と件数を再試行でも維持する。
    selection;
    // 多重出力を防ぎ、取得中だけ進捗を表示する。
    exporting = false;
    // 取得が完了したページの行数を表示する。
    rows = 0;
    // 取得失敗を確認画面内に表示する。
    error;
    // 閉じるアニメーションの間に到着した応答も破棄する。
    closing = false;

    // 所有画面を離れたときは開いているモーダルも閉じる。
    handleCancel = () => {
        // 既に閉じ始めたモーダルへ終了理由を再度渡さない。
        if (this.closing) return;
        // 次ページの取得と遅れて届く進捗を直ちに無効にする。
        this.closing = true;
        // Escや標準の閉じるボタンと同様に、保存せず終了する。
        this.close();
    };

    // 切断後の応答を表示や保存に使用しない。
    isCurrent = () => this.isConnected && !this.closing && !this.ownerSignal.aborted;

    // 検索結果の件数はモーダルを開いた状態で取得する。
    async connectedCallback() {
        // モーダルの準備中に呼び出し元が離脱した場合も閉じる。
        if (this.ownerSignal.aborted) {
            // 古い画面から新しい処理を開始しない。
            this.handleCancel();
            return;
        }
        // 所有画面の離脱時に標準モーダルを閉じる。
        this.ownerSignal.addEventListener('abort', this.handleCancel);
        // 月別・全期間では事前の件数照会を必要としない。
        if (this.period !== 'results') return;
        // 検索条件と件数が確定するまで出力ボタンを無効にする。
        try {
            // 出力時にも同じ一致IDを使用する。
            const selection = await this.prepareSelection(this.isCurrent);
            // 閉じた確認画面に件数を反映しない。
            if (this.isCurrent()) this.selection = selection;
        } catch (error) {
            // 件数取得を再開できるように閉じて開き直す手順を表示する。
            if (this.isCurrent()) this.error = getApexMessage(error, '検索結果の件数を取得できませんでした。閉じてもう一度お試しください。');
        }
    }

    // 標準の閉じるボタンやEscで閉じた場合も監視を解除する。
    disconnectedCallback() {
        // 既に閉じたモーダルを呼び出し元が保持し続けないようにする。
        this.ownerSignal.removeEventListener('abort', this.handleCancel);
    }

    // 全期間の表示と対象月の表示を切り替える。
    get range() {
        // 進捗中もどの範囲を出力しているか表示する。
        return this.exportSubject || (this.period === 'all' ? '取得可能な全期間' : this.month);
    }

    // 取得の前後で同じ出力範囲を案内する。
    get confirmation() {
        // 件数の未確定とゼロ件を区別する。
        return this.exportSubject ? this.exportSubject + 'をCSV出力しますか？' : confirmationText(this.period, this.range, this.selection?.count);
    }

    // 取得中と検索結果が未確定または空のときは実行できない。
    get confirmDisabled() {
        // 閉じ始めたモーダルからの再操作も防ぐ。
        return this.closing || this.exporting || (this.period === 'results' && !this.selection?.count);
    }

    // 確認済みの範囲をファイルにしてから完了を通知する。
    async handleExport() {
        // 二重クリックや画面離脱後の開始を防ぐ。
        if (this.confirmDisabled || !this.isCurrent()) return;
        // 再試行時は前回の進捗とエラーを取り下げる。
        this.rows = 0;
        // 読み込み中は前回のエラーを表示しない。
        this.error = undefined;
        // 出力だけを無効化し、キャンセルは常に使える状態にする。
        this.exporting = true;
        // ページ取得中も同じ確認画面で進捗とエラーを扱う。
        try {
            // 終了したページだけを進捗に加える。
            await this.buildFile(this.selection, this.isCurrent, rows => {
                // 中断済みの画面に進捗を反映しない。
                if (this.isCurrent()) this.rows = rows;
            });
            // Esc・キャンセル・離脱が先なら保存を通知しない。
            if (this.isCurrent()) {
                // 完了通知とキャンセルの競合を防ぐ。
                this.closing = true;
                // 出力完了で閉じた場合だけ呼び出し元でファイルを保存する。
                this.close(true);
            }
        } catch (error) {
            // 現在の出力だけに失敗理由を表示する。
            if (this.isCurrent()) {
                // 同じ条件で再試行できるよう操作を戻す。
                this.exporting = false;
                // Apexからのエラーと件数照合の失敗を確認画面に表示する。
                this.error = reduceErrors(error, 'CSVを出力できませんでした。');
            }
        }
    }
}
