# CI メタデータ検証ルール

この文書は、GitHub ActionsでSalesforce sourceを確認するときの運用ルールです。接続組織へのvalidate / deployは[組織操作ルール](org-operation-rules.md)に従います。

## 実行ルール

- CIはSalesforce組織へログインしない。
- CIは接続組織向けの全体manifestをvalidate / deployしない。
- CIは依存監査、整形、文書、lint、Salesforce Code Analyzer、スクリプトテスト、LWC Jestを実行する。
- Salesforce orgでのvalidateまたはdry-runは、push前に対象orgと限定scopeを確認してローカルで実行する。
- validate結果はPRへ記録するが、CI成功や組織へのdeploy完了と混同しない。
- CI用のSalesforce JWT秘密情報は管理しない。

## workflow の動作

`.github/workflows/ci.yml`はPRと`main`へのpushで次を実行します。

- `npm audit --audit-level=high`
- `npm run prettier:verify`
- `npm run docs:check`
- `npm run lint -- --no-error-on-unmatched-pattern`
- `npm run code-analyzer:ci`
- `npm run test:scripts`
- `npm run test:unit -- -- --runInBand --passWithNoTests`

Code AnalyzerのためにSalesforce CLIとCode Analyzer pluginを導入しますが、Salesforce組織へのログインやmetadata validateには使いません。

## push前のSalesforce検証

Salesforce metadataを変更した場合は、Git差分と明示した依存metadataだけをscopeに含め、対象orgを指定してvalidateまたはdry-runします。

```sh
sf project deploy validate \
    --metadata ApexClass:MyService \
    --metadata ApexClass:MyServiceTest \
    --test-level RunLocalTests \
    --target-org <alias>
```

対象metadata、件数、対象org alias、結果をPRへ記録します。全体manifestや`--source-dir force-app`へscopeを広げません。

## 確認観点

- workflowにSalesforce組織へのログイン処理がないこと。
- workflowにmetadata validate / deploy処理がないこと。
- Salesforce JWT用Secretを参照していないこと。
- Code Analyzer、スクリプトテスト、LWC Jestが維持されていること。
- Salesforce組織での限定scope検証がPRの確認結果へ記録されていること。

## 報告ルール

CI設定を変更した場合は、変更したworkflow、実行したローカル確認、Salesforce組織操作を実行していないことを報告します。
