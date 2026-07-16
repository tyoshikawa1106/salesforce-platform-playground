# データボード

## 概要

主要なSalesforce標準オブジェクトの参照可能なレコード件数をカードで一覧表示し、カードから汎用レコード検索画面へ遷移するLightning Web Componentです。

## 目的・利用場面

Lightningホームページで、主要データの件数を俯瞰し、確認したいオブジェクトのレコード一覧へ素早く移動するために利用します。

## 対象実装・メタデータ

### LWC

| 種別           | API 名                     | 役割                                               |
| -------------- | -------------------------- | -------------------------------------------------- |
| LWC            | `objectMetricsOverview`    | 件数カードの表示、再読み込み、検索画面への切り替え |
| LWC            | `objectRecordSearch`       | 選択したカードのレコード一覧表示                   |
| LWC            | `errorUtils`               | Apex エラーの画面表示用メッセージ変換              |
| LWC JavaScript | `objectMetricsOverview.js` | 件数取得と画面状態の制御                           |
| LWC JavaScript | `errorUtils.js`            | Apex エラーの画面表示用メッセージ変換              |

### Apex

| 種別         | API 名                                                                    | 役割                                                 |
| ------------ | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Apex Class   | `ObjectMetricsOverviewController`                                         | LWC からの件数取得要求の入口                         |
| Apex Class   | `ObjectMetricsOverviewSelector`                                           | 利用者が参照できるレコードの件数取得                 |
| Apex Class   | `ObjectMetricsOverviewService`                                            | カタログ順の件数サマリ組み立て                       |
| Apex Class   | `ObjectMetricCatalog`                                                     | カードキー、対象オブジェクト、ラベル、アイコンの定義 |
| Apex Wrapper | `ObjectMetricsOverviewSummaryWrapper`、`ObjectMetricsOverviewItemWrapper` | LWC へ返す件数情報                                   |

## 入力

- 利用者によるホームページの表示
- 再読み込み操作
- 件数カードの選択
- `objectRecordSearch` から通知されるレコード変更イベント

カードの対象は、取引先、取引先責任者、リード、商談、商談商品、商品、価格表、価格表エントリ、納入商品、キャンペーン、ケース、契約、注文、注文商品、エンタイトルメント、サービス契約、作業指示、作業指示品目、ナレッジ、行動、ToDo、メールメッセージ、メールテンプレート、レポート、ダッシュボード、ファイル、ユーザーです。

## 処理内容

1. `getObjectMetrics` をWireで呼び出します。
2. カタログに定義された各オブジェクトについて、利用者の参照権限を確認します。
3. `WITH USER_MODE` のCOUNTクエリで件数を取得します。ユーザーは有効ユーザーだけを数えます。
4. カタログの定義順にラベル、アイコン、件数を返します。
5. LWCは件数カードを表示し、カード選択時に同じ画面内で `objectRecordSearch` へ切り替えます。
6. 検索画面から戻る、またはレコード変更通知を受けると、ダッシュボード表示または件数を更新します。

## 出力・更新対象

- 対象オブジェクトごとの件数カード
- 50,000件以上の場合は `50,000+` と表示します。
- カード選択時は、カードキーを `objectRecordSearch` へ渡します。
- この機能自体はレコードを更新しません。

## 権限・実行条件

- LWCから直接呼び出す `ObjectMetricsOverviewController` のApexクラス実行権限が必要です。Controllerから呼び出す内部クラスへ個別のApexクラス実行権限を付与する必要はありません。
- 対象オブジェクトの参照権限が必要です。参照できないオブジェクトは0件として扱います。
- `with sharing` と `WITH USER_MODE` により、利用者の共有設定と参照権限を適用します。
- LWCは `lightning__HomePage` に公開されています。

## エラー処理

- 個別オブジェクトのCOUNTでQueryExceptionが発生した場合は、そのオブジェクトを0件として処理を継続します。
- 件数取得全体で例外が発生した場合は、Apexが一般化したメッセージを返し、LWCがエラーアラートを表示します。
- 再読み込みに失敗した場合も、画面上にエラーメッセージを表示します。

## 関連コンポーネント

- [汎用レコード検索](../object-record-search/index.md)
- Lightningホームページ

## テスト・確認観点

- `ObjectMetricsOverviewControllerTest`、`ObjectMetricsOverviewServiceTest`、`ObjectMetricsOverviewSelectorTest` で、カタログ順、実件数、0件、不明なAPI名、例外、50,000件上限を確認すること
- `objectMetricsOverview.test.js` で、初期表示、読込中、件数表示、上限表示、エラー、再読み込み、カード選択、検索画面からの復帰を確認すること
- ホームページ上でカードの表示順、ラベル、アイコン、レスポンシブ表示を確認します。
- 利用権限の異なるユーザーで件数とエラー表示を確認します。

## 制約・注意事項

- 対象オブジェクトと表示順は `ObjectMetricCatalog` の固定定義です。
- 件数は最大50,000件で打ち切るため、50,000件以上の正確な総数は表示しません。
- 参照できないオブジェクトと実際に0件のオブジェクトは、どちらも0件表示になります。
- 対象オブジェクト数に応じてCOUNTクエリを個別に実行します。

### 大量データと性能

- 各COUNTクエリは50,000件で打ち切り、上限到達時は `capped=true` としてLWCへ返します。
- カタログ内のオブジェクトごとにCOUNTクエリを実行するため、対象追加時はSOQL数と画面応答時間への影響を確認します。
- 件数取得は同期Apexで実行し、再読み込みと子コンポーネントのレコード変更通知でも再実行されます。

## 既知の差異・確認事項

- 状態: 現行実装確認済み、承認済み要求との差異は未判定
- 現行実装は `objectMetricsOverview`、関連Apexクラス、Apexテスト、Jestテストから確認しています。
- `HomeFlexiPage` にLWCは配置されていますが、リポジトリ内の権限セットには `ObjectMetricsOverviewController` の有効なApexクラス実行権限がありません。利用者へ別途権限が付与されていない場合、件数取得は実行できません。
- 承認済み要求または画面要件の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。
