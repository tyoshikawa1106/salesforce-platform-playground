import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getLatestScan from '@salesforce/apex/AccountDataQualityScanController.getLatestScan';
import startScan from '@salesforce/apex/AccountDataQualityScanController.startScan';
import { reduceErrors } from 'c/errorUtils';
import { createScanViewModel } from './accountDataQualityScanLogic';

// スキャン開始成功を利用者へ通知する見出し
const START_SUCCESS_TITLE = 'スキャンを開始しました';
// スキャン開始失敗を利用者へ通知する見出し
const START_ERROR_TITLE = 'スキャンを開始できません';
// 状態取得失敗時の代替文言
const LOAD_ERROR_MESSAGE =
    'スキャン状態を読み込めませんでした。時間をおいてもう一度お試しください。';

// 取引先データ品質スキャンの開始と状態表示を管理
export default class AccountDataQualityScan extends LightningElement {
    // Apexから取得した直近スキャンを保持
    scan;
    // 状態取得または開始失敗時の利用者向け文言を保持
    errorMessage;
    // スキャン開始中の二重操作を防ぐ状態を保持
    isStarting = false;
    // 手動状態更新中の二重操作を防ぐ状態を保持
    isRefreshing = false;
    // refreshApexへ渡すwireレスポンス全体を保持
    wiredLatestScanResult;

    // Apexから直近スキャンを取得して画面状態へ反映
    @wire(getLatestScan)
    wiredLatestScan(result) {
        // 後続の手動更新に使えるwireレスポンスを保存
        this.wiredLatestScanResult = result;
        // 成功データとエラーを排他的に参照
        const { data, error } = result;

        // nullを含む取得成功時は最新状態へ置き換え
        if (data !== undefined) {
            // 直近スキャンまたは履歴なし状態を保存
            this.scan = data;
            // 再取得成功時は以前のエラーを解除
            this.errorMessage = undefined;
        // 取得失敗時は古い結果を表示せずエラーへ移行
        } else if (error) {
            // 古いスキャン結果を破棄
            this.scan = undefined;
            // Salesforceエラーを利用者向け文言へ変換
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        }
    }

    // 現在状態をテンプレート表示用モデルへ変換
    get viewModel() {
        // 状態値、進捗、操作可否をLogicで一度に組み立て
        return createScanViewModel(this.scan, this.isBusy);
    }

    // 表示対象のスキャンがあるか判定
    get hasScan() {
        // 表示モデルが生成済みの場合だけ結果領域を表示
        return Boolean(this.viewModel);
    }

    // 初回wire応答を待っているか判定
    get isLoading() {
        // 成功、失敗、明示エラーのいずれもない間だけ読込中とする
        return (
            !this.errorMessage &&
            this.wiredLatestScanResult?.data === undefined &&
            !this.wiredLatestScanResult?.error
        );
    }

    // 開始または状態更新中か判定
    get isBusy() {
        // いずれかのサーバー処理中は操作を抑止
        return this.isStarting || this.isRefreshing;
    }

    // スキャン開始ボタンの無効状態を返却
    get isStartDisabled() {
        // 初回読込中またはサーバー処理中は新しい開始を許可しない
        if (this.isLoading || this.isBusy) {
            // 状態が確定するまで開始操作を抑止
            return true;
        }
        // 履歴がない場合は最初の開始を許可
        return this.viewModel ? !this.viewModel.canStart : false;
    }

    // 状態更新ボタンの無効状態を返却
    get isRefreshDisabled() {
        // 初回読込中またはサーバー処理中は更新を許可しない
        return this.isLoading || this.isBusy;
    }

    // 利用者操作から新しいスキャンを開始
    async handleStart() {
        // 現在状態で開始できない要求は処理しない
        if (this.isStartDisabled) {
            // 表示状態を変えず開始処理を終了
            return;
        }

        // 開始完了まで操作を抑止
        this.isStarting = true;
        // 新しい操作前に以前のエラーを解除
        this.errorMessage = undefined;
        // 非同期登録と最新状態の再取得を順番に実行
        try {
            // Apexへ取引先スキャン開始を要求
            await startScan();
            // 開始受付を成功トーストで通知
            this.dispatchEvent(
                new ShowToastEvent({
                    // 成功内容を示す見出しを設定
                    title: START_SUCCESS_TITLE,
                    // 次の操作を案内する文言を設定
                    message: '状態を更新して進捗を確認してください。',
                    // 成功トーストとして表示
                    variant: 'success'
                })
            );
            // 非同期登録直後の待機状態を画面へ反映
            await this.refreshLatestScan();
        // 開始失敗時は画面とトーストの両方へ理由を表示
        } catch (error) {
            // Salesforceエラーを利用者向け文言へ変換
            this.errorMessage = reduceErrors(
                error,
                'スキャンを開始できませんでした。'
            );
            // 開始失敗をエラートーストで通知
            this.dispatchEvent(
                new ShowToastEvent({
                    // 失敗内容を示す見出しを設定
                    title: START_ERROR_TITLE,
                    // 画面と同じ安全なエラー文言を設定
                    message: this.errorMessage,
                    // エラートーストとして表示
                    variant: 'error'
                })
            );
        // 成否にかかわらず開始操作を再び許可
        } finally {
            // 開始中状態を解除
            this.isStarting = false;
        }
    }

    // 利用者操作から最新の進捗を再取得
    async handleRefresh() {
        // wire初期化前または操作中の更新要求は処理しない
        if (!this.wiredLatestScanResult || this.isBusy) {
            // 現在表示を維持して更新処理を終了
            return;
        }

        // 更新完了まで操作を抑止
        this.isRefreshing = true;
        // 手動更新結果を画面へ反映
        try {
            // 保存済みwireレスポンスをSalesforceから再取得
            await this.refreshLatestScan();
        // 更新失敗時は画面上のエラーへ移行
        } catch (error) {
            // Salesforceエラーを利用者向け文言へ変換
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        // 成否にかかわらず更新操作を再び許可
        } finally {
            // 更新中状態を解除
            this.isRefreshing = false;
        }
    }

    // 保存済みwireレスポンスを最新状態へ更新
    async refreshLatestScan() {
        // wire初期化済みの場合だけサーバー再取得を実行
        if (this.wiredLatestScanResult) {
            // refreshApex完了まで呼び出し元の処理を待機
            await refreshApex(this.wiredLatestScanResult);
        }
    }
}
