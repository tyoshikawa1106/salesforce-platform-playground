# レポートエクスポート保護判定

## 機能の用途

レポートのエクスポート件数が10,000行を超えた場合に、トランザクションセキュリティポリシーの評価結果を真にする判定Flowです。

通常のレポートエクスポートまたはExcel Connectorによるエクスポートで、大量データの持ち出しをトランザクションセキュリティポリシーの対象として検出するために利用します。

## 対象メタデータ

| 種別                        | API 名                                                                                                                                                                         | 役割                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Flow                        | [sfdc_default_ReportExport_Protection_Flow](../../../../force-app/main/default/flows/sfdc_default_ReportExport_Protection_Flow.flow-meta.xml)                                  | レポート操作イベント（`ReportEvent`）を評価するトランザクションセキュリティ Flow |
| Transaction Security Policy | [sfdc_default_ReportExport_Protection](../../../../force-app/main/default/transactionSecurityPolicies/sfdc_default_ReportExport_Protection.transactionSecurityPolicy-meta.xml) | Flowを参照し、Step-Up Authenticationを要求するアクティブなポリシー               |

### 関連コンポーネント

- レポート操作イベント（`ReportEvent`）のトランザクションセキュリティポリシー
- `sfdc_default_ReportExport_Protection` Transaction Security Policy
- Salesforce Shieldのトランザクションセキュリティ機能

## アクセスするデータ・項目

- `EvaluationOutcome`: トランザクションセキュリティポリシーへ返す真偽値の判定結果
- レコードの作成、更新、削除は行いません。

### Flow変数

| API名                | 型          | 用途 |
| -------------------- | ----------- | ---- |
| `EvaluationOutcome`  | Boolean     | 出力 |
| `myVariable_myEvent` | ReportEvent | 入力 |

## 起動条件・入力

- `myVariable_myEvent`: 評価対象の `ReportEvent` レコード
- 判定に利用する値:
    - `Operation`
    - `RowsProcessed`

### 権限・実行条件

- トランザクションセキュリティポリシーから `ReportEvent` を入力して実行することを前提とします。
- Flow の状態は下書き（`Draft`）です。
- `EventSettings.enableTransactionSecurityPolicies` と関連ポリシーの `active` は `true` です。

## エラー判定

独自のFault経路はありません。条件に一致しない場合はエラーにせず、`EvaluationOutcome` を `false` にします。

## 処理詳細

1. `Operation` が `ReportExported` または `ReportExportedUsingExcelConnector` であるか確認します。
2. `RowsProcessed` が10,000より大きいか確認します。
3. 両方を満たす場合は `EvaluationOutcome` に `true`、それ以外は `false` を設定します。

### 制約・注意事項

- 判定境界は「10,000以上」ではなく「10,000より大きい」です。
- Salesforceが提供するデフォルトFlowであり、変更時は関連するトランザクションセキュリティポリシーへの影響を確認する必要があります。
- Flowは下書き（`Draft`）ですが、関連ポリシーとTransaction Security Policies設定は有効です。

### セキュリティと運用

- 判定結果だけを返し、Flow自体はエクスポートの遮断、通知、監査記録を実行しません。
- 実際の制御内容は、このFlowを参照するトランザクションセキュリティポリシーの設定に依存します。
- ポリシーの無効化、紐付け変更、閾値変更はデータ持ち出し制御へ影響するため、セキュリティ判断として人間の確認が必要です。

### 既知の差異・確認事項

- 状態: 未確認（承認済み要求との比較）
- 現行実装は `sfdc_default_ReportExport_Protection_Flow.flow-meta.xml` と `sfdc_default_ReportExport_Protection.transactionSecurityPolicy-meta.xml` から確認しています。
- 有効なポリシーによる実際のレポートエクスポート制御は未確認です。
- 承認済みのセキュリティ要求と関連ポリシーの管理元をリポジトリ内で確認できないため、要求との差異は判定していません。

### 確認手順

[確認手順](tests.md)
