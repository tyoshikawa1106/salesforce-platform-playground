import { LightningElement, wire } from 'lwc';
import LightningConfirm from 'lightning/confirm';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import TIME_ZONE from '@salesforce/i18n/timeZone';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import searchAccounts from '@salesforce/apex/AccountMassUpdateController.searchAccounts';
import saveAccounts from '@salesforce/apex/AccountMassUpdateController.saveAccounts';
import { applyEdit, buildRows, buildSaveRequest, retainFailedChanges, validateSearch } from './accountMassUpdateLogic';

export default class AccountMassUpdate extends LightningElement {
    // 日付範囲の解釈と一覧の日時表示を同じ利用者設定へ揃える
    timeZone = TIME_ZONE;
    // 入力中の条件は現在の検索結果の条件から分離
    filters = { searchTerm: '', startDate: '', endDate: '' };
    // ページ移動では実行済みの検索条件を利用
    appliedFilters = {};
    // 元の値を取消と競合確認の基準として保持
    records = [];
    // 未保存の変更だけを行IDで管理
    changes = {};
    // 行単位のエラーを表示
    errors = {};
    // 権限と表示用の行を保持
    editableFields = [];
    // 入力・権限を合成した表示行を保持
    rows = [];
    // レコードタイプごとの選択肢を再利用
    picklists = {};
    // レコードタイプ未指定の行で使う既定値
    defaultRecordTypeId;
    // 現在取得中の選択肢のレコードタイプ
    activeRecordTypeId;
    // 前ページへ戻るため検索境界の履歴を保持
    anchors = [null];
    // 先頭ページを初期位置に設定
    pageIndex = 0;
    // 保存後に末尾行が見えなくなってもページ境界を保持
    nextAnchor = null;
    // 未検索時には次ページへ進ませない
    hasNext = false;
    // 未検索と検索結果ゼロ件を区別
    searched = false;
    // 検索・保存・確認中の重複操作を防止
    busy = false;
    // 画面全体のエラーを保持
    errorMessage = '';
    // 保存処理の結果を案内
    message = '';
    // 所有者候補を有効なユーザーに限定
    ownerFilter = { criteria: [{ fieldPath: 'IsActive', operator: 'eq', value: true }] };

    @wire(getObjectInfo, { objectApiName: ACCOUNT_OBJECT })
    handleObjectInfo({ data, error }) {
        // レコードタイプ未指定の行で使う既定値を取得
        if (data) {
            // 組織で利用可能な既定レコードタイプを保持
            this.defaultRecordTypeId = data.defaultRecordTypeId;
            // 表示中の行に必要な選択肢を取得
            this.loadNextPicklist();
        } else if (error) {
            // 項目情報が使えない場合は編集を有効化しない
            this.errorMessage = '取引先の項目情報を取得できませんでした。権限を確認してください。';
        }
    }

    @wire(getPicklistValuesByRecordType, { objectApiName: ACCOUNT_OBJECT, recordTypeId: '$activeRecordTypeId' })
    handlePicklists({ data, error }) {
        // 選択肢は取得中のレコードタイプへ対応させる
        if (data || error) {
            // 取得失敗も記録して無限再取得を防ぐ
            this.picklists = { ...this.picklists, [this.activeRecordTypeId]: data?.picklistFieldValues || {} };
            // 選択肢を取得できない項目を読取専用にする
            if (error) {
                // 選択肢が不明な項目を編集できない理由を表示
                this.errorMessage = '一部の選択肢を取得できませんでした。該当する項目は編集できません。';
            }
            // 同一画面の別レコードタイプを順番に取得
            this.loadNextPicklist();
            // 入力値と変更状態を一覧へ反映
            this.refreshRows();
        }
    }

    get navigationDisabled() {
        // 選択肢の応答を別ページへ誤適用しないよう取得中の移動を抑止
        return this.busy || Boolean(this.activeRecordTypeId);
    }

    get changeCount() {
        // 件数表示と保存操作に同じ変更集合を使用
        return Object.keys(this.changes).length;
    }

    get saveDisabled() {
        // 保存中と変更なしの場合は保存・取消を抑止
        return this.navigationDisabled || this.changeCount === 0;
    }

    get previousDisabled() {
        // 検索中または先頭ページでは戻れない
        return this.navigationDisabled || this.pageIndex === 0;
    }

    get nextDisabled() {
        // 検索中または最終ページでは進めない
        return this.navigationDisabled || !this.hasNext;
    }

    get pageNumber() {
        // 画面上は一から始まるページ番号を表示
        return this.pageIndex + 1;
    }

    get emptyResult() {
        // 未検索の案内とゼロ件の結果を区別
        return this.searched && !this.busy && this.records.length === 0;
    }

    handleFilter(event) {
        // 条件変更だけでは現在の入力内容を破棄しない
        this.filters = { ...this.filters, [event.target.name]: event.target.value };
    }

    handleEdit(event) {
        // 処理中に遅れて届いたイベントを無視
        if (this.busy) {
            return;
        }
        // 行と項目をイベント発生元から特定
        const { id, field } = event.target.dataset;
        // 所有者検索と選択リストの値形式を揃える
        const value = field === 'OwnerId' ? event.detail.recordId : event.detail.value;
        // 権限がない項目のイベントを反映しない
        if (!this.editableFields.includes(field)) {
            return;
        }
        // 元の値との差分だけを保持
        this.changes = applyEdit(this.records, this.changes, id, field, value);
        // 編集し直した行の古いエラーを解除
        this.errors = { ...this.errors, [id]: '' };
        // 前の保存結果の案内を解除
        this.message = '';
        // 入力値と変更状態を一覧へ反映
        this.refreshRows();
    }

    async handleSearch() {
        // 処理中の連打を抑止
        if (this.navigationDisabled) {
            return;
        }
        // 入力要素の妥当性と期間の前後関係を確認
        const valid = [...this.template.querySelectorAll('[data-search]')].reduce((result, input) => {
            // 入力エラーの表示と真偽値の取得を分ける
            input.reportValidity();
            // reportValidityの戻り値に依存しない
            return input.checkValidity() && result;
        }, true);
        // 無効な条件で既存の変更を破棄しない
        this.errorMessage = validateSearch(this.filters);
        if (!valid || this.errorMessage) {
            return;
        }
        // 確認モーダル中も二重操作を防止
        this.busy = true;
        // 入力値と変更状態を一覧へ反映
        this.refreshRows();
        try {
            // 未保存の変更があるときだけ破棄を確認
            if (
                this.changeCount &&
                !(await LightningConfirm.open({
                    message: '未保存の変更を破棄して再検索しますか？',
                    label: '変更の破棄を確認',
                    variant: 'header'
                }))
            ) {
                return;
            }
            // 応答成功までは現在の結果を保持
            await this.fetchPage(0, null, { ...this.filters });
        } catch {
            // 現在の編集内容を維持して再試行を案内
            this.errorMessage = '検索できませんでした。条件と権限を確認して再実行してください。';
        } finally {
            // 失敗や取消でも操作可能へ戻す
            this.busy = false;
            // 入力値と変更状態を一覧へ反映
            this.refreshRows();
        }
    }

    async handlePage(event) {
        // 処理中はページ境界を変更しない
        if (this.navigationDisabled) {
            return;
        }
        // 前後のボタンから目的ページを決定
        const next = event.target.name === 'next';
        // 境界外の操作を拒否
        if ((next && !this.hasNext) || (!next && this.pageIndex === 0)) {
            return;
        }
        // 確認中も画面操作を停止
        this.busy = true;
        // 入力値と変更状態を一覧へ反映
        this.refreshRows();
        try {
            // 同意がなければ現在ページの変更を維持
            if (
                this.changeCount &&
                !(await LightningConfirm.open({
                    message: '未保存の変更を破棄してページを移動しますか？',
                    label: '変更の破棄を確認',
                    variant: 'header'
                }))
            ) {
                return;
            }
            // 次ページは保持済みの末尾境界、前ページは履歴を使用
            const target = this.pageIndex + (next ? 1 : -1);
            // 保存後に末尾行の参照権限がなくなっても移動できる
            const anchor = next ? this.nextAnchor : this.anchors[target];
            await this.fetchPage(target, anchor, this.appliedFilters);
        } catch {
            // ページ移動失敗では編集内容を残す
            this.errorMessage = 'ページを取得できませんでした。再実行してください。';
        } finally {
            // すべての終了経路で操作を再開
            this.busy = false;
            // 入力値と変更状態を一覧へ反映
            this.refreshRows();
        }
    }

    handleCancel() {
        // 保存中は取消しない
        if (this.busy) {
            return;
        }
        // 検索時の元データへ戻す
        this.changes = {};
        // 元の値へ戻る行の保存エラーを解除
        this.errors = {};
        // 前の保存結果の案内を解除
        this.message = '';
        // 入力値と変更状態を一覧へ反映
        this.refreshRows();
    }

    async handleSave() {
        // 空更新と二重保存を防止
        if (this.saveDisabled) {
            return;
        }
        // 所有者や選択欄の入力エラーを表示
        const valid = [...this.template.querySelectorAll('[data-field]')].reduce((result, input) => {
            // 入力エラーの表示と真偽値の取得を分ける
            input.reportValidity();
            // reportValidityの戻り値に依存しない
            return input.checkValidity() && result;
        }, true);
        // 入力が正しいときだけサーバーへ送る
        if (!valid) {
            return;
        }
        // 保存中の編集を止める
        this.busy = true;
        // 前の操作のエラーを解除
        this.errorMessage = '';
        // 前の保存結果の案内を解除
        this.message = '';
        // 入力値と変更状態を一覧へ反映
        this.refreshRows();
        try {
            // 変更項目と検索時の日時を送信
            const request = buildSaveRequest(this.records, this.changes);
            // 一回の要求で最大200件を保存
            const result = await saveAccounts(request);
            // サーバー側の検証拒否を画面へ表示
            if (result.errorMessage) {
                // サーバーで判定した拒否理由を表示
                this.errorMessage = result.errorMessage;
                return;
            }
            // 成功した行を再保存しないよう即座に除外
            this.changes = retainFailedChanges(this.changes, result.successIds);
            // 失敗した行へ保存結果を対応
            this.errors = result.errors || {};
            // 成功件数と失敗件数を区別して案内
            this.message = `${result.successIds.length}件を保存しました。${Object.keys(this.errors).length}件は保存できませんでした。`;
            // 保存と再取得の失敗を区別して案内
            await this.refreshAfterSave(result.successIds);
        } catch (error) {
            // 不確実な応答では入力を保持し再検索を案内
            this.errorMessage =
                error.message || '保存結果を確認できませんでした。再検索して現在の値を確認してください。';
        } finally {
            // 部分失敗でも残りの編集を再開
            this.busy = false;
            // 入力値と変更状態を一覧へ反映
            this.refreshRows();
        }
    }

    async refreshAfterSave(successIds) {
        // 保存済み行は再取得成功前に編集可能な古い行として残さない
        const saved = new Set(successIds);
        // 再取得で行が消えても元の表示上限と順序を保持
        const pageRecords = this.records;
        // 失敗行は再取得でアクセス不能になっても入力とともに残す
        const failedRecords = this.records.filter((record) => !saved.has(record.Id));
        // 保存前の値で再編集できないよう表示を更新
        this.records = failedRecords;
        try {
            // 標準画面のキャッシュにも更新を通知
            await notifyRecordUpdateAvailable(successIds.map((recordId) => ({ recordId })));
            // 保存後の実値を現在ページの条件で再取得
            const anchor = this.anchors[this.pageIndex];
            const result = await searchAccounts(this.searchRequest(this.appliedFilters, anchor));
            // 権限変化による失敗も保存成功とは分けて扱う
            if (result.errorMessage) {
                throw new Error(result.errorMessage);
            }
            // 競合を再保存で上書きしないよう失敗行の元バージョンを維持
            const failedMap = new Map(
                failedRecords.filter((record) => this.changes[record.Id]).map((record) => [record.Id, record])
            );
            // 保存前のページの順序と件数を維持して再取得値を反映
            const freshMap = new Map(result.records.map((record) => [record.Id, record]));
            // 失敗行は元の値、その他は取得できた最新値を採用
            this.records = pageRecords
                .map((record) => failedMap.get(record.Id) || freshMap.get(record.Id))
                .filter(Boolean);
            // 保存前の境界より後ろの行へ進める状態を維持
            this.hasNext = this.hasNext || result.hasNext;
            // 最新の項目更新権限を反映
            this.editableFields = result.editableFields;
            // 表示する行のレコードタイプ別選択肢を準備
            this.loadNextPicklist();
        } catch {
            // 成功行の変更を復元せず再取得だけを案内
            this.errorMessage =
                '保存処理は完了しましたが一覧の再取得に失敗しました。未保存の行を確認後、再検索してください。';
            // 不完全な再取得結果で次ページへ進ませない
            this.hasNext = false;
        }
    }

    async fetchPage(target, anchor, filters) {
        // 日付の空文字をApexで許容するnullへ変換して検索
        const result = await searchAccounts(this.searchRequest(filters, anchor));
        // 権限や条件のエラーでは表示中の入力を破棄しない
        if (result.errorMessage) {
            // サーバーで判定した拒否理由を表示
            this.errorMessage = result.errorMessage;
            return;
        }
        // 応答成功後にページ状態をまとめて置き換え
        this.records = result.records;
        // 表示と別に末尾のページ境界を保持
        const last = result.records[result.records.length - 1];
        // 末尾行の日時とIDを次ページの起点にする
        this.nextAnchor = last ? { afterCreated: last.CreatedDate, afterId: last.Id } : null;
        // 最新の項目更新権限を反映
        this.editableFields = result.editableFields;
        // 取得結果の次ページ有無を反映
        this.hasNext = result.hasNext;
        // 取得が成功したページを現在位置にする
        this.pageIndex = target;
        // 現在位置までのページ境界だけを保持
        this.anchors = target === 0 ? [null] : [...this.anchors.slice(0, target), anchor];
        // 今回取得した条件をページ移動用に確定
        this.appliedFilters = { ...filters };
        // 表示中の未保存の変更を破棄
        this.changes = {};
        // 元の値へ戻る行の保存エラーを解除
        this.errors = {};
        // 前の操作のエラーを解除
        this.errorMessage = '';
        // 前の保存結果の案内を解除
        this.message = '';
        // 検索結果の表示を有効化
        this.searched = true;
        // 表示する行のレコードタイプ別選択肢を準備
        this.loadNextPicklist();
    }

    searchRequest(filters, anchor) {
        // Apexの検索Wrapperへ条件とページ境界を対応
        return {
            request: {
                searchTerm: filters.searchTerm || '',
                startDate: filters.startDate || null,
                endDate: filters.endDate || null,
                afterCreated: anchor?.afterCreated || null,
                afterId: anchor?.afterId || null
            }
        };
    }

    loadNextPicklist() {
        // 現在の結果に必要なレコードタイプだけを問い合わせ
        const next = this.records
            .map((record) => record.RecordTypeId || this.defaultRecordTypeId)
            .find((id) => id && !Object.hasOwn(this.picklists, id));
        // 取得済みの型を再取得しない
        this.activeRecordTypeId = next;
        // 入力値と変更状態を一覧へ反映
        this.refreshRows();
    }

    refreshRows() {
        // 変更経路を共通化してハイライトと入力値の不整合を防止
        this.rows = buildRows(
            this.records,
            this.changes,
            this.errors,
            this.editableFields,
            this.picklists,
            this.defaultRecordTypeId,
            this.busy
        );
    }
}
