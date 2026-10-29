import { withUiErrorBoundary } from 'c/uiErrorBoundary';
import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import {
    createPdfPageReference,
    isAccountRecordId
} from './accountPdfExportLogic';

// PDF出力の失敗を通知する見出し
const ERROR_TITLE = 'PDFを出力できません';
// 対象レコードを確認できない場合の案内
const INVALID_ACCOUNT_MESSAGE =
    '取引先レコードを確認できませんでした。ページを再読み込みしてください。';
// URL生成または別タブの起動に失敗した場合の案内
const OPEN_ERROR_MESSAGE =
    'PDFを開けませんでした。時間をおいてもう一度お試しください。';

// 画面を持たないレコードアクションを例外境界内で実行
export default class AccountPdfExport extends withUiErrorBoundary(NavigationMixin(
    LightningElement
), 'accountPdfExport') {
    // レコードページから対象取引先を受け取る
    @api recordId;

    // URL生成と別タブ起動中の重複を抑止
    isExecuting = false;

    // アクションを二重実行せず、終了時は必ず再操作を可能にする
    @api
    async invoke() {
        // 操作・取得・描画の入口で自画面の例外を捕捉
        try {
            // 連続クリックの二重実行を拒否
            if (this.isExecuting) {
                // 進行中の処理を維持
                return;
            }

            // 次の操作では前回の診断を持ち越さない
            this.clientError = undefined;
            // 非同期処理を開始する前に操作をロック
            this.isExecuting = true;
            // URL生成とブラウザ処理の失敗を同じ操作として捕捉
            try {
                // 他オブジェクトや未指定のIDでPDFを開かない
                if (!isAccountRecordId(this.recordId)) {
                    // 入力不足を例外診断とは分けて案内
                    this.showError(INVALID_ACCOUNT_MESSAGE);
                    // URL生成を行わず終了
                    return;
                }

                // 対象レコードだけを含む遷移情報を生成
                const pageReference = createPdfPageReference(this.recordId);
                // Salesforce標準のURL生成を待機
                const pdfUrl = await this[NavigationMixin.GenerateUrl](
                    pageReference
                );
                // 認証情報を渡さず同じSalesforceのPDFを別タブへ開く
                window.open(pdfUrl, '_blank', 'noopener,noreferrer');
            } catch (caughtError) {
                // 例外本文を記録せず、失敗した処理だけを通知
                this.reportClientError(caughtError, 'invoke', 'processing');
                // 画面のないアクションではエラートーストで処理場所も表示
                this.showError(OPEN_ERROR_MESSAGE);
            } finally {
                // 成功・失敗とも再操作を許可
                this.isExecuting = false;
            }
        } catch (boundaryError) {
            // 利用者の入力や応答本文を含めず処理場所を表示
            this.reportClientError(boundaryError, 'invoke', 'ui-event');
            // 外側の準備処理で失敗した場合も利用者へ通知
            this.showError(OPEN_ERROR_MESSAGE);
        }
    }

    // 画面のないアクションではエラー時だけ標準トーストを送信
    showError(message) {
        // 診断がある場合だけ固定の処理場所と種類を補足
        this.dispatchEvent(
            new ShowToastEvent({
                title: ERROR_TITLE,
                message: this.clientError ? `${message} 処理場所：${this.clientError.location}（${this.clientError.errorType}）` : message,
                variant: 'error'
            })
        );
    }
}
