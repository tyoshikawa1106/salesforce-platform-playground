import { createClientErrorDetails, safeClientDiagnostic } from 'c/errorUtils';

// 画面とモーダルで子の例外捕捉・診断状態・エラー時だけの記録を共用
export function withUiErrorBoundary(Base, component) {
    // NavigationMixinとLightningModalの既存動作を維持して拡張
    return class UiErrorBoundary extends Base {
        // 診断表示は失敗時だけ生成し、成功ログは保持しない
        clientError;

        // 明示的に捕捉した例外を本文なしの診断へ変換
        reportClientError(error, operation, phase, diagnosticCode) {
            // 画面名は各利用元が固定値として渡す
            const details = { ...createClientErrorDetails(error, component, operation, phase), ...(diagnosticCode ? safeClientDiagnostic(diagnosticCode) : {}) };
            // 同じ描画失敗の再通知で表示と記録を繰り返さない
            if (this.clientError?.location === details.location && this.clientError.errorType === details.errorType
                && this.clientError.frames.join('|') === details.frames.join('|') && this.clientError.code === details.code) { return; }
            // 共通表示部品へ診断だけを渡す
            this.clientError = details;
            // 元のError・メッセージ・API応答・入力値をコンソールへ渡さない
            console.error('LWC: 画面処理でエラーが発生しました。', details);
        }

        // 子の描画と宣言的イベントの失敗を親画面内で受け止める
        errorCallback(error) {
            // Salesforce全体の例外ではなく、この境界内の子だけを扱う
            this.reportClientError(error, 'errorCallback', 'child-component');
        }

        // 利用者が診断を閉じても業務上の失敗状態や入力は変えない
        handleClientErrorDismiss() {
            // 次の失敗は同じ処理であっても改めて表示する
            this.clientError = undefined;
        }
    };
}
