# 設定変更履歴エクスプローラー

## 概要

Salesforce の設定変更履歴（`SetupAuditTrail`）を月単位で検索・分析し、対象月または保持期間内の履歴を CSV で保存できます。

## 目的・利用場面

日常の調査では、操作やユーザーで履歴を絞り込み、集計から該当する明細を開けます。監査提出資料には、Salesforce の設定画面「設定変更履歴を参照」の標準ダウンロードを使用します。

## 対象実装・メタデータ

- カスタムタブ `SetupAuditTrailExplorer` が画面の入口です。`setupAuditTrailExplorer.js` が取得と画面操作を制御し、`setupAuditTrailExplorerLogic.js` が表示値と CSV 明細を組み立てます。`setupAuditTrailChart.js` が集計結果を表示します。
- `SetupAuditTrailExplorerController` が一覧・集計・候補・CSV の要求を受け付け、`SetupAuditTrailExplorerSelector` が履歴を取得します。`SetupAuditTrailExplorerService` が期間・ページ境界の検証と結果の整形を行い、`SetupAuditTrailExplorerWrapper` が明細・集計・次ページの境界を返します。

## 入力

一覧と分析は対象月、日付、ユーザー、名前空間、アクション、代理ユーザーを指定できます。月別 CSV は選択月の全履歴を、全期間 CSV は出力開始日時より前の取得可能な全履歴を対象とします。どちらも一覧の絞り込み条件から独立しています。

## 処理内容

一覧は作成日時と ID の降順でページを取得します。分析はページ間で同じ集計軸の件数を合算します。CSV はページ境界を引き継いで明細を取得し、全ページが揃った時点でダウンロードを開始します。

## 出力・更新対象

ファイル名は月別が `SetupAuditTrailMonthly<開始時刻>.csv`、全期間が `SetupAuditTrailAll<開始時刻>.csv` です。開始時刻には、出力操作時点の Unix タイムスタンプ（ミリ秒）を使用します。

両方の CSV は BOM 付き UTF-8 です。レコードとセル内の改行には LF を使い、セル内の引用符は二重にします。履歴の文字は Unicode のまま出力します。

| 列                             | 出力する値                                                                  |
| ------------------------------ | --------------------------------------------------------------------------- |
| 日付                           | `CreatedDate` を実行ユーザーのタイムゾーンで表記。時は 0〜23、分と秒は 2 桁 |
| ユーザー                       | `CreatedBy.Username`。取得値がない場合は空欄                                |
| ソースの名前空間プレフィックス | `ResponsibleNamespacePrefix`                                                |
| アクション                     | `Display` の説明文                                                          |
| セクション                     | `Section`                                                                   |
| 代理ユーザー                   | `DelegateUser`                                                              |

## 権限・実行条件

タブと Apex コントローラーを利用でき、実行ユーザーが設定変更履歴を参照できることが必要です。Selector はユーザーモードで照会します。

## エラー処理

CSV の一時的な通信障害では、失敗したページを同じ境界から一度再試行します。全ページを取得できない場合はエラーを表示します。取得中に画面を離れた場合は、その出力要求の応答を破棄します。

## 関連コンポーネント

提出用の標準 CSV は設定画面からダウンロードできます。[Salesforce ヘルプ「設定変更履歴の監視」](https://help.salesforce.com/s/articleView?id=admin_monitorsetup.htm&language=ja&type=5)

## テスト・確認観点

`setupAuditTrailExplorer.test.js` は両方のダウンロード操作、ページ境界、ファイル名と CSV の内容を確認します。`setupAuditTrailExplorerLogic.test.js` は日付をまたぐ時刻、セル内改行、Unicode 文字を確認します。`SetupAuditTrailExplorerSelectorTest` と `SetupAuditTrailExplorerServiceTest` は検索条件とページ処理を検証します。

## 制約・注意事項

全期間は、その時点で Salesforce が保持し、実行ユーザーが取得できる期間です。履歴を長期保存する機能はありません。

## 既知の差異・確認事項

**差異あり。** 標準 CSV は、システムによる変更を会社名やプロセス名で表示する場合があります。また、代理ログインでアクセスを許可したユーザーは、取得した作成者ログイン名から特定できない場合があります。アクション本文のオブジェクト表示名や文字コードにも差が生じるため、監査時は標準ダウンロードでユーザーと本文を確認します。
