# 取引先データ品質スキャン

## 概要

取引先を更新せず、利用者が参照できる Account を `Database.Cursor` と連鎖する Queueable Apex で分割検査し、項目不足の件数と進捗を表示する読み取り専用機能です。

## 目的・利用場面

大量の取引先を一つのトランザクションへ読み込まず、電話番号、業種、請求先住所、Webサイト、取引先番号の不足状況を確認するときに使用します。Salesforceアプリのホームページから開始し、手動更新で進捗と最終結果を確認します。

## 対象実装・メタデータ

### 入口・LWC

- `HomeFlexiPage`: Salesforceアプリのホームページ下部左側へLWCを配置
- `accountDataQualityScan`
- `accountDataQualityScan.js`
- `accountDataQualityScanLogic.js`

### Apex

- `AccountDataQualityScanController`
- `AccountDataQualityScanQueueable`
- `AccountDataQualityScanSelector`
- `AccountDataQualityScanService`
- `AccountDataQualityScanWrapper`

### 設定・権限

- `DataQualityScan__c`: スキャン状態、進捗、集計結果、最終エラーを保持
- `DataQualityScan__c.Active_Key__c`: Accountスキャンの同時実行を防ぐ一意キー
- `DataQualityScan__c.Status__c`: `Pending`、`Running`、`Completed`、`Failed`を保持
- `DataQualityScan__c.Target_Object__c`: MVPでは`Account`を保持
- `DataQualityScan__c.Total_Count__c`
- `DataQualityScan__c.Processed_Count__c`
- `DataQualityScan__c.Missing_Phone_Count__c`
- `DataQualityScan__c.Missing_Industry_Count__c`
- `DataQualityScan__c.Missing_Address_Count__c`
- `DataQualityScan__c.Missing_Website_Count__c`
- `DataQualityScan__c.Missing_Account_Number_Count__c`
- `DataQualityScan__c.Started_At__c`
- `DataQualityScan__c.Completed_At__c`
- `DataQualityScan__c.Error_Message__c`
- `DataQualityScan__c.Requested_By__c`
- `Account_Data_Quality_Scan`: Account参照、スキャン管理、Apex実行に必要なPermission Set

## 入力

利用者が「スキャンを開始」を押したことを開始入力とします。対象条件、検査項目、分割件数は利用者入力で変更できません。

対象は、開始利用者が`USER_MODE`で参照できるすべてのAccountです。Person Accountが有効な組織ではPerson Accountも除外しません。

## 処理内容

1. `Pending`または`Running`のAccountスキャンがないことを確認します。
2. 利用者が参照できるAccountの`Database.Cursor`を作成し、対象総件数を`DataQualityScan__c`へ保存します。
3. `AccountDataQualityScanQueueable`を登録します。
4. QueueableごとにCursorから最大500件を取得し、項目不足を集計します。
5. 処理済み位置と累積件数を保存し、残りがあればCursorと次位置を次のQueueableへ引き継ぎます。
6. 全取得位置を処理したら`Completed`へ変更し、終了日時を保存します。
7. LWCは自動ポーリングせず、「スキャン状態を更新」の操作で最新状態を再取得します。

### 品質判定

| 集計項目   | 不足条件                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 電話番号   | `Account.Phone`が空                                                                                 |
| 業種       | `Account.Industry`が空                                                                              |
| 請求先住所 | `BillingStreet`、`BillingCity`、`BillingState`、`BillingPostalCode`、`BillingCountry`のいずれかが空 |
| Webサイト  | `Account.Website`が空                                                                               |
| 取引先番号 | `Account.AccountNumber`が空                                                                         |

### 状態遷移と重複防止

```text
Pending -> Running -> Completed
                  \-> Failed
```

`Pending`または`Running`の間は`Active_Key__c`へ`Account`を設定します。この項目の一意制約により、画面のボタン制御とは別に同時開始を拒否します。`Completed`または`Failed`へ移るとキーを空にし、新しいスキャンを開始できるようにします。

## 出力・更新対象

LWCは次を表示します。

- ステータス
- 対象総件数、処理済み件数、進捗率
- 5種類の不足件数
- 開始日時、終了日時
- 失敗時の利用者向けエラー

更新するのは`DataQualityScan__c`だけです。Accountレコードは更新しません。

## 権限・実行条件

`Account_Data_Quality_Scan` Permission Setが必要です。

- Accountの参照権限と検査対象項目のFLS
- `DataQualityScan__c`の作成、参照、更新権限と対象項目のFLS
- 対象Apexクラスの実行権限

AccountのCursorは`AccessLevel.USER_MODE`で作成し、スキャン管理レコードは`as user`で保存します。共有、CRUD、FLSを超えて処理しません。

## エラー処理

実行中スキャンがある場合は、新しい開始を拒否して完了後の再実行を案内します。Queueableが未処理例外で終了した場合はFinalizerが`Failed`、終了日時、安全な最終エラーを保存し、同時実行防止キーを解放します。

LWCと管理レコードにはSOQL、スタックトレース、内部ID、個人情報を含む例外詳細を表示しません。

## 関連コンポーネント

- [Apex Cursorsの設計と使い分け](../../../knowledge/apex-cursors.md)
- Salesforce標準のAccount
- Salesforce標準のQueueable ApexとFinalizer

## テスト・確認観点

- `AccountDataQualityScanServiceTest`: 各不足条件、累積、完了、失敗、禁止状態遷移
- `AccountDataQualityScanSelectorTest`: USER_MODE Cursor、分割取得、管理レコードI/O、一意制約
- `AccountDataQualityScanQueueableTest`: 0件、1区間完了、複数区間の連鎖
- `AccountDataQualityScanControllerTest`: 初期表示、開始、重複開始拒否、直近結果
- `accountDataQualityScan.test.js`: 画面状態、開始、手動更新、エラー、アクセシビリティ
- `accountDataQualityScanLogic.test.js`: 状態ラベル、操作可否、表示値の正規化

組織上ではCursorのQueueable間シリアライズ、Permission Setを割り当てた利用者権限、Queueable連鎖、Finalizerによる失敗記録を確認します。

## 制約・注意事項

- 1 Queueableの取得件数は500件固定です。
- 自動ポーリングとPlatform Event通知は行いません。
- 途中位置からの再開は行わず、失敗後は新しいスキャンとして最初から実行します。
- 過去のスキャン管理レコードを自動削除しません。
- 複数オブジェクト、CSV出力、自動修正、任意項目設定には対応しません。
- Cursorはガバナ制限を回避する機能ではなく、各`fetch()`と取得行はSOQL関連の制限へ加算されます。

## 既知の差異・確認事項

接続済みのDeveloper Editionへ限定デプロイし、Permission Setを割り当てた利用者で62件のAccountスキャンが完了することを確認済みです。

`HomeFlexiPage`へ配置したLWCをChromeで確認し、初期表示、スキャン開始中の操作抑止、完了表示、手動更新を確認済みです。

500件を超える実データでのQueueable連鎖と、実障害時のFinalizerによる失敗記録は組織上で未確認です。これらの分岐はApexテストで確認します。
