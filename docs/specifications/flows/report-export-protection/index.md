# レポートエクスポート保護判定

## 概要

レポートのエクスポート件数が10,000行を超えた場合に、Transaction Security Policyの評価結果を真にする判定Flowです。

## 目的・利用場面

通常のレポートエクスポートまたはExcel Connectorによるエクスポートで、大量データの持ち出しをTransaction Security Policyの対象として検出するために利用します。

## 対象メタデータ

| 種別 | API名                                       | 役割                                           |
| ---- | ------------------------------------------- | ---------------------------------------------- |
| Flow | `sfdc_default_ReportExport_Protection_Flow` | ReportEventを評価するTransaction Security Flow |

## 入力

- `myVariable_myEvent`: 評価対象の `ReportEvent` レコード
- 判定に利用する値:
    - `Operation`
    - `RowsProcessed`

## 処理内容

1. `Operation` が `ReportExported` または `ReportExportedUsingExcelConnector` であるか確認します。
2. `RowsProcessed` が10,000より大きいか確認します。
3. 両方を満たす場合は `EvaluationOutcome` に `true`、それ以外は `false` を設定します。

## 出力・更新対象

- `EvaluationOutcome`: Transaction Security Policyへ返すBooleanの判定結果
- レコードの作成、更新、削除は行いません。

## 権限・実行条件

- Transaction Security Policyから `ReportEvent` を入力して実行することを前提とします。
- Flowの状態は `Draft` であり、現状のままでは有効なポリシー判定として実行されません。

## エラー処理

独自のFault経路はありません。条件に一致しない場合はエラーにせず、`EvaluationOutcome` を `false` にします。

## 関連コンポーネント

- ReportEvent Transaction Security Policy
- Salesforce ShieldのTransaction Security機能

## テスト・確認観点

- 2種類の対象Operationで10,001行以上の場合に `true` になること
- 10,000行の場合は `false` になること
- 対象外Operationでは行数にかかわらず `false` になること
- 入力値が不足する場合のTransaction Security標準動作を確認すること
- 有効化する場合は、関連ポリシーとの紐付けと実際のレポートエクスポートで判定を確認すること

## 制約・注意事項

- 判定境界は「10,000以上」ではなく「10,000より大きい」です。
- Salesforceが提供するデフォルトFlowであり、変更時は関連するTransaction Security Policyへの影響を確認する必要があります。
- 現在はDraftのため、有効化を仕様として確定していません。
