# テストデータ一括削除画面

## 概要

開発組織で、テストデータ投入対象オブジェクトの全レコードを子から親へ削除する画面です。seedの識別値や投入履歴で絞り込みません。手動作成したレコードも削除します。

## 目的・利用場面

開発用の投入データを再作成する前に、対象オブジェクトの全レコードを画面から削除します。

## 対象実装・メタデータ

- `testDataDelete`: Lightning App Builder、ホームページ、Lightningタブへ配置する画面。
- `TestDataDelete` CustomTab、「Salesforce」CustomApplication: 画面を開くためのタブとナビゲーション。
- `SalesforceApplicationUser` PermissionSet: Salesforceアプリと削除タブの表示設定。
- `testDataDelete.js`: 実行条件・残件数の取得、確認ダイアログ、削除受付を制御。
- `testDataDeleteLogic.js`: 対象行、状態、開始可否を生成。
- `TestDataDeleteController`: 画面用の参照とバッチ登録。
- `TestDataDeleteService`: 実効権限、対象範囲、確認と重複の判定。
- `TestDataDeleteSelector`: 実効権限、残件数、標準ジョブの取得。
- `TestDataDeleteWrapper`: 組織名、実行条件、対象一覧、照会時点の件数とジョブ。

## 入力

画面の「全件削除」と確認ダイアログの承認で開始します。オブジェクト名や順序を利用者が変更する機能はありません。受付時は確認文字列をApexへ渡しますが、認可は別途サーバーで判定します。

## 処理内容

1. 組織と実効権限を確認し、固定の対象一覧を表示する。
2. 有効な各オブジェクトの残件数を別々のApex要求で取得する。権限不足・取得失敗はゼロ件と扱わない。
3. 全件削除を確認後、Apexで権限と重複を再確認して最初のバッチを登録する。
4. 「実行状況・残件数を確認」で標準ジョブと件数を再取得する。自動更新は行わない。

## 出力・更新対象

組織名、削除順序、オブジェクト名、残件数、実行中の有無、受付ジョブIDとその状態を表示します。実際の更新対象はバッチ仕様を参照してください。投入履歴・独自の実行ログ用オブジェクトは作成しません。

## 権限・実行条件

- SandboxではないDeveloper Edition、または`IsSandbox=true`かつ`TrialExpirationDate`が未来のScratch Orgだけで開始する。一般Sandbox、本番、期限切れScratch、判定失敗は拒否する。
- `UserPermissionAccess.PermissionsModifyAllData`が有効であること。プロファイル名や単独の権限セット割当から推測しない。
- `PermissionsQueryAllFiles`は実行条件に含めない。ファイルの削除と残件数確認は実行ユーザーが照会できる範囲に限られ、照会できないファイルの削除完了は保証しない。
- 存在する対象オブジェクトの参照・クエリ・削除権限が必要。
- Salesforceアプリと`TestDataDelete`タブへのアクセスが必要。既存の`SalesforceApplicationUser`権限セットでアプリとタブを表示する。
- LWCから呼ぶ`TestDataDeleteController`へのアクセスが必要。`SalesforceApplicationUser`はこのクラスへのアクセスや`Modify All Data`を付与しないため、プロファイルなどで実効権限を別途満たす。
- 残件数が未確認、全件ゼロ、権限不足、処理中、受付不明の場合は開始できない。

## エラー処理

問い合わせの失敗時は状態を未確認に戻し、開始を抑止します。削除要求の応答が失われた場合は「受付不明」を維持し、自動再送しません。Apexジョブで状況を確認してから画面を開き直します。

受付したジョブはIDで追跡し、最新ジョブへ置き換えません。受付ジョブは連続実行の最初の一件なので、その終了を全体完了と表示しません。受付ジョブ終了後に通常データが残る場合は「削除停止・残件数あり」と表示し、後続の停止理由は結果メールで確認し、想定外のエラーや中断は設定のApexジョブでも確認します。

## 関連コンポーネント

- [テストデータ削除バッチ](../../apex/batches/test-data-delete/index.md)
- [テストデータ投入](../../scripts/test-data-import/index.md)
- [削除手順](../../../deployment/test-data-delete.md)
- `TestDataDeleteBatchService.getEnvironment`: dev・Scratchに限定する共通の判定。
- `UserPermissionAccess`: 現在ユーザーの合成済み実効権限。
- `AsyncApexJob`: 削除処理の標準ジョブ。

## テスト・確認観点

- `TestDataDeleteControllerTest`: 実効権限による拒否、確認なしの拒否、正規受付、重複起動、指定ジョブの取得。
- `TestDataDeleteServiceTest`: 対象外照会、全ファイル照会権限なしでの計画生成、実行環境。
- `TestDataDeleteSelectorTest`: 削除済みを除く件数、未指定IDの検索抑止。
- `testDataDelete.test.js`: 確認キャンセル、二重起動、権限・通信失敗、受付不明、アクセシビリティ。
- `testDataDeleteLogic.test.js`: 未確認とゼロ件の区別、別ジョブとの混同防止、全体状態。

## 制約・注意事項

- 各残件数はその行の照会時点の値で、全オブジェクトを同一トランザクションで集計したものではない。処理中のデータ投入・編集は停止する。
- 画面は現在の残件数と標準ジョブ状態を示し、削除成功・失敗の累計は表示しない。バッチ間で引き継いだ累計件数は結果メールで通知する。独自の履歴レコードとして保存せず、画面再表示時に過去の累計を復元する機能は持たない。通知する件数の範囲と送信条件は[バッチ仕様の結果メール](../../apex/batches/test-data-delete/index.md#結果メール)を参照する。
- 画面を閉じても受け付けたバッチは継続する。匿名Apex用の起動スクリプトやSchedulerは提供しない。Apexを実行・変更できる管理者からの呼び出しを技術的に封鎖する仕組みではない。
- `TestDataDelete` Lightningタブを「Salesforce」アプリのナビゲーション末尾に配置する。アクセスできる管理者が画面を開いて実行する。

## 既知の差異・確認事項

なし。
