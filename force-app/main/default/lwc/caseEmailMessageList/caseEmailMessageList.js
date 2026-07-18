import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getEmailMessageCount from '@salesforce/apex/CaseEmailMessageController.getEmailMessageCount';
import getEmailMessages from '@salesforce/apex/CaseEmailMessageController.getEmailMessages';
import { reduceErrors } from 'c/errorUtils';

// 初期取得と追加取得で共通する利用者向けエラー文言
const LOAD_ERROR_MESSAGE =
    'メールメッセージを読み込めませんでした。時間をおいてもう一度お試しください。';

// Caseレコードページにメールログをカーソルページングで表示
export default class CaseEmailMessageList extends LightningElement {
    // レコードページから表示中CaseのIDを受け取る
    @api recordId;

    // 取得済みメールを表示順に保持
    emailMessages = [];
    // 初期取得または再取得失敗時の全体エラーを保持
    errorMessage;
    // 追加取得失敗時の一覧内エラーを保持
    loadMoreErrorMessage;
    // Caseに紐づくメールの総件数を保持
    totalEmailMessageCount = 0;
    // 次ページを取得できる状態を保持
    hasNextPage = false;
    // 追加取得に使うApexページトークンを保持
    nextPageToken;
    // 件数取得後に初期ページwireを開始する制御値
    initialPageToken;
    // 手動再読み込み中の操作抑止状態を保持
    isRefreshing = false;
    // 追加ページ取得中の操作抑止状態を保持
    isLoadingMore = false;
    // 初期ページのrefreshApexに使うwireレスポンスを保持
    wiredEmailMessagesResult;
    // 総件数のrefreshApexに使うwireレスポンスを保持
    wiredEmailMessageCountResult;

    // 初期ページより先にCaseのメール総件数を取得
    @wire(getEmailMessageCount, { caseId: '$recordId' })
    wiredEmailMessageCount(result) {
        // 手動再読み込みに使えるwireレスポンスを保存
        this.wiredEmailMessageCountResult = result;
        // 成功データとエラーを排他的に参照
        const { data, error } = result;

        // 0件を含む取得成功時は初期ページwireを有効化
        if (data !== undefined) {
            // Apexの整数値をJavaScript数値へ統一
            this.totalEmailMessageCount = Number(data);
            // nullを渡して初期ページ取得を開始
            this.initialPageToken = null;
            // 再取得成功時は以前の全体エラーを解除
            this.errorMessage = undefined;
        // 件数取得失敗時は一覧を表示せず全体エラーへ移行
        } else if (error) {
            // 件数を安全な0件へ戻す
            this.totalEmailMessageCount = 0;
            // 初期ページwireを無効化
            this.initialPageToken = undefined;
            // 以前の一覧とページング状態を共通処理で破棄
            this.resetPagination();
            // Salesforceエラーを利用者向け文言へ変換
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        }
    }

    // 件数取得後にメール一覧の初期ページを取得
    @wire(getEmailMessages, {
        caseId: '$recordId',
        pageToken: '$initialPageToken'
    })
    wiredEmailMessages(result) {
        // 手動再読み込みに使えるwireレスポンスを保存
        this.wiredEmailMessagesResult = result;
        // 成功データとエラーを排他的に参照
        const { data, error } = result;

        // 取得成功時は初期ページを一覧状態へ反映
        if (data) {
            // 行変換と次ページ状態更新をまとめて実行
            this.applyInitialPage(data);
            // 再取得成功時は以前の全体エラーを解除
            this.errorMessage = undefined;
        // 取得失敗時は古い一覧を残さず全体エラーへ移行
        } else if (error) {
            // 以前の一覧とページング状態を共通処理で破棄
            this.resetPagination();
            // Salesforceエラーを利用者向け文言へ変換
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        }
    }

    // 1件以上のメールを表示できるか判定
    get hasEmailMessages() {
        // 一覧の要素数をテンプレート用真偽値へ変換
        return this.emailMessages.length > 0;
    }

    // 取得状態と総件数を反映したカードタイトルを返却
    get cardTitle() {
        // 初期取得前とエラー時は不確かな件数を表示しない
        if (!this.hasLoaded || this.errorMessage) {
            // 件数を含まない固定タイトルを返却
            return 'メールログ';
        }
        // 取得成功後はCase全体のメール件数を表示
        return `メールログ (${this.totalEmailMessageCount})`;
    }

    // 初期ページwireが最初のレスポンスを受信したか判定
    get hasLoaded() {
        // 成功または失敗のどちらかを受信済みなら完了扱い
        return Boolean(
            this.wiredEmailMessagesResult?.data ||
                this.wiredEmailMessagesResult?.error
        );
    }

    // 初期取得、再取得、追加取得をまとめた操作中状態を返却
    get isBusy() {
        // いずれかの非同期処理中は重複操作を抑止
        return this.isLoading || this.isRefreshing || this.isLoadingMore;
    }

    // 初期ページwireのレスポンス待ち状態を判定
    get isLoading() {
        // データ、エラー、明示エラーのいずれもない間だけ読込中とする
        return (
            !this.errorMessage &&
            !this.wiredEmailMessagesResult?.data &&
            !this.wiredEmailMessagesResult?.error
        );
    }

    // 利用者操作で総件数と初期ページを再取得
    async handleRefresh() {
        // 両wireの初期化前は整合した再取得を開始しない
        if (
            !this.wiredEmailMessageCountResult ||
            !this.wiredEmailMessagesResult
        ) {
            // wire応答がそろうまで再読み込みを終了
            return;
        }

        // 再取得完了まで操作を抑止
        this.isRefreshing = true;
        // 新しい再取得開始時に追加取得エラーを解除
        this.loadMoreErrorMessage = undefined;
        // 総件数と初期ページを順番に再取得
        try {
            // 先に総件数を最新化
            await refreshApex(this.wiredEmailMessageCountResult);
            // 続けて初期ページを最新化
            await refreshApex(this.wiredEmailMessagesResult);
        // 再取得失敗時はカード全体をエラー状態へ移行
        } catch (error) {
            // どちらかの失敗をカード全体のエラーへ反映
            this.errorMessage = reduceErrors(error, LOAD_ERROR_MESSAGE);
        // 成否にかかわらず操作抑止を解除
        } finally {
            // 成否にかかわらず再読み込み状態を解除
            this.isRefreshing = false;
        }
    }

    // 次ページトークンを使ってメール一覧を追加取得
    async handleLoadMore() {
        // 次ページなし、トークンなし、処理中の場合は重複取得しない
        if (!this.hasNextPage || !this.nextPageToken || this.isBusy) {
            // 現在一覧を維持して追加取得を終了
            return;
        }

        // 追加取得完了まで操作を抑止
        this.isLoadingMore = true;
        // 再試行開始時は以前の追加取得エラーを解除
        this.loadMoreErrorMessage = undefined;
        // 次ページ取得と一覧追加を1つの処理単位で実行
        try {
            // 現在の次ページトークンでApexを命令的に呼び出す
            const page = await getEmailMessages({
                // 表示中Caseだけを検索対象に指定
                caseId: this.recordId,
                // 前回応答のカーソルを次ページ境界に指定
                pageToken: this.nextPageToken
            });
            // 追加ページを表示行とページ区切りへ変換
            const nextEmailMessages = this.createNextPageDisplayRows(page);
            // 既存順を保って新しい表示行を末尾へ追加
            this.emailMessages = [
                ...this.emailMessages,
                ...nextEmailMessages
            ];
            // 続く追加取得へ使うトークンを更新
            this.nextPageToken = page.nextPageToken;
            // 総件数とトークンから追加取得可否を再判定
            this.updateHasNextPage();
        // 追加取得失敗時は現在一覧を維持してエラーだけを表示
        } catch (error) {
            // 初期一覧を残したまま追加取得エラーだけを表示
            this.loadMoreErrorMessage = reduceErrors(
                error,
                LOAD_ERROR_MESSAGE
            );
        // 成否にかかわらず追加取得の操作抑止を解除
        } finally {
            // 成否にかかわらず追加取得状態を解除
            this.isLoadingMore = false;
        }
    }

    // Apex初期ページ応答を一覧とページング状態へ反映
    applyInitialPage(page) {
        // 各EmailMessageをテンプレート表示行へ変換
        this.emailMessages = (page.emailMessages || []).map((emailMessage) =>
            this.createDisplayRow(emailMessage)
        );
        // 次回取得に使うApexページトークンを保存
        this.nextPageToken = page.nextPageToken;
        // 総件数と取得済み件数から次ページ有無を判定
        this.updateHasNextPage();
        // 初期ページ成功時は以前の追加取得エラーを解除
        this.loadMoreErrorMessage = undefined;
    }

    // 次ページトークンと未取得件数から追加取得可否を更新
    updateHasNextPage() {
        // トークンがあり取得済み件数が総件数未満の場合だけ有効化
        this.hasNextPage = Boolean(
            this.nextPageToken &&
                this.emailMessages.length < this.totalEmailMessageCount
        );
    }

    // 追加ページを表示行へ変換して先頭行へ区切り情報を付加
    createNextPageDisplayRows(page) {
        // 追加前の件数から新しいページの開始位置を計算
        const rangeStart = this.emailMessages.length + 1;
        // Apex応答を既存行と同じ表示構造へ変換
        const nextEmailMessages = (page.emailMessages || []).map(
            (emailMessage) => this.createDisplayRow(emailMessage)
        );
        // 空ページでは区切り行を作らずそのまま返却
        if (nextEmailMessages.length === 0) {
            // 空の表示行一覧を呼び出し側へ返却
            return nextEmailMessages;
        }

        // 新しいページの最終表示位置を計算
        const rangeEnd = rangeStart + nextEmailMessages.length - 1;
        // 追加ページ先頭行へスクリーンリーダー用区切りを追加
        nextEmailMessages[0] = {
            ...nextEmailMessages[0],
            // テンプレートへページ区切り表示を通知
            hasPageSeparator: true,
            // aria参照に使う一意な区切りIDを生成
            pageSeparatorId: `email-page-separator-${rangeStart}-${rangeEnd}`,
            // 読み込んだ表示範囲を支援技術へ通知
            pageSeparatorMessage: `${rangeStart}件目から${rangeEnd}件目を読み込みました`
        };
        // 区切り情報を含む追加表示行を返却
        return nextEmailMessages;
    }

    // EmailMessageレコードをテンプレート表示用の行へ変換
    createDisplayRow(emailMessage) {
        // Incomingフラグを日本語の送受信区分へ変換
        const direction = emailMessage.Incoming ? '受信' : '送信';
        // 送受信区分に対応するLightningアイコンを選択
        const directionIconName = emailMessage.Incoming
            ? 'utility:email_open'
            : 'utility:sender_email';
        // 差出人未設定時もリンクラベルを空にしない
        const fromAddress = emailMessage.FromAddress || '(差出人なし)';
        // 宛先未設定時も表示内容を空にしない
        const toAddress = emailMessage.ToAddress || '(宛先なし)';

        // 表示、リンク、アクセシビリティ用の値をまとめて返却
        return {
            // 繰り返し描画のキーにEmailMessage IDを使用
            id: emailMessage.Id,
            // テキスト本文がない場合は代替表示を使用
            body: emailMessage.TextBody || '(本文なし)',
            // 日本語の送受信区分を表示
            direction,
            // 送受信区分に対応するアイコン名を設定
            directionIconName,
            // 詳細領域のaria参照IDを生成
            detailsId: `email-message-details-${emailMessage.Id}`,
            // 整形済み差出人を表示
            fromAddress,
            // 差出人を宛先にしたメールリンクを生成
            fromAddressUrl: `mailto:${encodeURIComponent(fromAddress)}`,
            // メッセージ見出しのaria参照IDを生成
            headingId: `email-message-${emailMessage.Id}`,
            // Salesforceの送受信日時を保持
            messageDate: emailMessage.MessageDate,
            // EmailMessage標準詳細ページの相対URLを生成
            recordUrl: `/lightning/r/EmailMessage/${emailMessage.Id}/view`,
            // 件名未設定時もカードを識別できる代替表示を使用
            subject: emailMessage.Subject || '(件名なし)',
            // 差出人、宛先、送受信区分を要約文へ統合
            summary: `${fromAddress} から ${toAddress} への${direction}メール`,
            // 要約領域のaria参照IDを生成
            summaryId: `email-message-summary-${emailMessage.Id}`,
            // 整形済み宛先を表示
            toAddress,
            // 宛先を宛先にしたメールリンクを生成
            toAddressUrl: `mailto:${encodeURIComponent(toAddress)}`
        };
    }

    // 一覧と次ページ情報を未取得状態へ初期化
    resetPagination() {
        // 以前取得したメール一覧を破棄
        this.emailMessages = [];
        // 追加取得ボタンを無効化
        this.hasNextPage = false;
        // 古いページトークンを破棄
        this.nextPageToken = undefined;
    }
}
