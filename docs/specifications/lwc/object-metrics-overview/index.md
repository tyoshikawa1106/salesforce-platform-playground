# データボード

## 概要

主要なSalesforce標準オブジェクトの参照可能なレコード件数をカードで一覧表示し、カードから汎用レコード検索画面へ遷移するLightning Web Componentです。

## 目的・利用場面

Lightningホームページで、主要データの件数を俯瞰し、確認したいオブジェクトのレコード一覧へ素早く移動するために利用します。

## 対象実装・メタデータ

Apex本体と同名Test、補助LWC、共通部品の対応は[画面・帳票の構成一覧](../../screen-and-report-components.md)も参照してください。

### LWC

| 種別           | API 名                          | 役割                                               |
| -------------- | ------------------------------- | -------------------------------------------------- |
| LWC            | `objectMetricsOverview`         | 件数カードの表示、再読み込み、検索画面への切り替え |
| LWC            | `objectRecordSearch`            | 選択したカードのレコード一覧表示                   |
| LWC            | `errorUtils`                    | Apex エラーの画面表示用メッセージ変換              |
| LWC JavaScript | `objectMetricsOverview.js`      | 件数取得と画面状態の制御                           |
| LWC JavaScript | `objectMetricsOverviewLogic.js` | 件数応答とカード表示モデルの生成                   |
| LWC JavaScript | `errorUtils.js`                 | Apex エラーの画面表示用メッセージ変換              |

### 設定・権限

- `LwcObjectMetricsOverview`: [ObjectMetricsOverviewController](../../../../force-app/main/default/classes/ObjectMetricsOverviewController.cls)のApexクラス実行権限

### Apexコードと対応テスト

| Apex本体                                                                                                                  | 役割                                                               | 同名Test                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| [ObjectMetricsOverviewController](../../../../force-app/main/default/classes/ObjectMetricsOverviewController.cls)         | データボード LWC に表示するレコード件数サマリ提供                  | [ObjectMetricsOverviewControllerTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewControllerTest.cls)         |
| [ObjectMetricsOverviewItemWrapper](../../../../force-app/main/default/classes/ObjectMetricsOverviewItemWrapper.cls)       | 1 つのオブジェクト件数カードを LWC に返す Wrapper                  | [ObjectMetricsOverviewItemWrapperTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewItemWrapperTest.cls)       |
| [ObjectMetricsOverviewQueryRunner](../../../../force-app/main/default/classes/ObjectMetricsOverviewQueryRunner.cls)       | 固定カタログに含まれる異なる SObject の件数問い合わせを調整        | [ObjectMetricsOverviewQueryRunnerTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewQueryRunnerTest.cls)       |
| [ObjectMetricsOverviewSelector](../../../../force-app/main/default/classes/ObjectMetricsOverviewSelector.cls)             | オブジェクト件数一覧で使う件数 SOQL の実行                         | [ObjectMetricsOverviewSelectorTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewSelectorTest.cls)             |
| [ObjectMetricsOverviewService](../../../../force-app/main/default/classes/ObjectMetricsOverviewService.cls)               | データボードで表示するオブジェクト件数の検証、集計、サマリ組み立て | [ObjectMetricsOverviewServiceTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewServiceTest.cls)               |
| [ObjectMetricsOverviewSummaryWrapper](../../../../force-app/main/default/classes/ObjectMetricsOverviewSummaryWrapper.cls) | オブジェクト件数結果を LWC に返す Wrapper                          | [ObjectMetricsOverviewSummaryWrapperTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewSummaryWrapperTest.cls) |
| [ObjectMetricCatalog](../../../../force-app/main/default/classes/ObjectMetricCatalog.cls)                                 | データボードで扱うオブジェクト定義一元管理                         | [ObjectMetricCatalogTest](../../../../force-app/main/default/classes/ObjectMetricCatalogTest.cls)                                 |

テストの共通準備は[TestDataFactory](../../../../force-app/main/default/classes/TestDataFactory.cls)、その契約は[TestDataFactoryTest](../../../../force-app/main/default/classes/TestDataFactoryTest.cls)で確認できます。

## 入力

- 利用者によるホームページの表示
- 再読み込み操作
- 件数カードの選択
- `objectRecordSearch` から通知されるレコード変更イベント

カードの対象と表示順は [ObjectMetricCatalog](../../../../force-app/main/default/classes/ObjectMetricCatalog.cls) を正とします。

## 処理内容

1. `getObjectMetrics` をWireで呼び出します。
2. Serviceがカタログに定義された各オブジェクトの参照権限を確認し、件数取得計画を作成します。
3. 専用Coordinatorが現在トランザクションの残りSOQL数を確認し、`WITH USER_MODE` のCOUNTクエリを順次実行します。ユーザーは有効ユーザーだけを数えます。
4. Serviceが未加工件数を表示上限付きの値へ集計し、カタログの定義順にラベル、アイコン、件数を返します。
5. LWCは件数カードを表示し、カード選択時に同じ画面内で `objectRecordSearch` へ切り替えます。
6. 検索画面から戻る、またはレコード変更通知を受けると、ダッシュボード表示または件数を更新します。

## 出力・更新対象

- 対象オブジェクトごとの件数カード
- 50,000件以上の場合は `50,000+` と表示します。
- カード選択時は、カードキーを `objectRecordSearch` へ渡します。
- この機能自体はレコードを更新しません。

## 権限・実行条件

- `LwcObjectMetricsOverview` Permission Setで、LWCから直接呼び出す[ObjectMetricsOverviewController](../../../../force-app/main/default/classes/ObjectMetricsOverviewController.cls)のApexクラス実行権限を付与します。Controllerから呼び出す内部クラスへ個別のApexクラス実行権限を付与する必要はありません。
- 対象オブジェクトの参照権限が必要です。参照できないオブジェクトは件数を取得不能として扱います。
- `with sharing` と `WITH USER_MODE` により、利用者の共有設定と参照権限を適用します。
- LWCは `lightning__HomePage` に公開されています。

## エラー処理

手動更新と子の `recordschanged` 通知は同じ再取得処理を使用します。再取得失敗はデータボードに表示し、子の保存・削除の成功とは区別します。次の再取得成功時にエラーを解除します。

- 個別オブジェクトのCOUNTでQueryExceptionが発生した場合は、Coordinatorがそのカードだけを取得不能として処理を継続します。Selectorは例外を捕捉・変換しません。
- 件数取得全体で例外が発生した場合は、Apexが一般化したメッセージを返し、LWCがエラーアラートを表示します。
- 再読み込みに失敗した場合も、画面上にエラーメッセージを表示します。

## 関連コンポーネント

- [汎用レコード検索](../object-record-search/index.md)
- Lightningホームページ

## テスト・確認観点

- [ObjectMetricCatalogTest](../../../../force-app/main/default/classes/ObjectMetricCatalogTest.cls)で、カード定義の順序、キーとオブジェクトの対応、許可対象、返却一覧の独立性を確認すること

- [ObjectMetricsOverviewControllerTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewControllerTest.cls)、[ObjectMetricsOverviewQueryRunnerTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewQueryRunnerTest.cls)、[ObjectMetricsOverviewServiceTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewServiceTest.cls)、[ObjectMetricsOverviewSelectorTest](../../../../force-app/main/default/classes/ObjectMetricsOverviewSelectorTest.cls) で、カタログ順、主要オブジェクトの実件数、0件、不明なAPI名、例外、クエリ数、集計上限の境界を確認すること
- `objectMetricsOverview.test.js` で、初期表示、読込中、件数表示、上限表示、エラー、再読み込み、カード選択、検索画面からの復帰を確認すること
- ホームページ上でカードの表示順、ラベル、アイコン、レスポンシブ表示を確認します。
- 利用権限の異なるユーザーで件数とエラー表示を確認します。

## 制約・注意事項

- 対象オブジェクトと表示順は [ObjectMetricCatalog](../../../../force-app/main/default/classes/ObjectMetricCatalog.cls) の固定定義です。
- 件数取得計画は最大50件です。固定カタログの対象数または現在トランザクションの残りSOQL数が上限を満たさない場合は、個別取得を始める前に全体をエラーとして返します。
- 件数は表示上限で打ち切るため、上限以上の正確な総数は表示しません。
- 取得に成功した0件は「0」、参照不可・機能なし・個別の取得失敗は「取得できません」と表示します。取得状態は件数と別の`available`で返します。
- 対象オブジェクト数に応じてCOUNTクエリを個別に実行します。

### 大量データと性能

- 各COUNTクエリは表示上限で打ち切り、上限到達時は `capped=true` としてLWCへ返します。
- カタログ内のオブジェクトごとにCOUNTクエリを実行するため、対象追加時はSOQL数と画面応答時間への影響を確認します。
- 件数取得は同期Apexで実行し、再読み込みと子コンポーネントのレコード変更通知でも再実行されます。

## 既知の差異・確認事項

- 状態: 現行実装確認済み、承認済み要求との差異は未判定
- 現行実装は `objectMetricsOverview`、関連Apexクラス、Apexテスト、Jestテストから確認しています。
- 承認済み要求または画面要件の管理元をリポジトリ内で確認できないため、要求との差異は判定していません。

権限セットには、件数サマリーの入口と、配下のレコード検索で使う[ObjectRecordSearchController](../../../../force-app/main/default/classes/ObjectRecordSearchController.cls)へのアクセスを含めます。オブジェクト・項目の参照や更新権限は付与しません。
