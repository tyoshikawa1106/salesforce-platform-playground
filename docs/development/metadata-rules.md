# メタデータ開発ルール

Salesforce メタデータを追加・更新するときの実務ルールです。

## 基本方針

- デプロイ対象の正本は `force-app/main/default` 配下に置く。
- 変更対象に必要なメタデータだけを追加・取得する。
- 組織から retrieve したメタデータは、コミット前に差分を確認する。
- 組織固有の値、認証情報、個人環境の値はメタデータに入れない。
- コードや既存メタデータから確認できない業務仕様を推測で固定しない。

## 依存関係の確認

振る舞いを変える前に、関連する依存を確認します。

- Object / Field
- Record Type / Page Layout / Lightning Page
- Permission Set / Profile
- Flow / Validation Rule / Approval Process
- Apex / Trigger / LWC / Aura

依存が確認できない場合は、作業報告に確認事項として残します。

## 取得と追加

- retrieve はタスクに必要な範囲に絞る。
- 自動生成に見える差分や権限系の広い差分は、必要性を確認してから残す。
- `package.xml` は、タスクで明示されていない限り一時的な取得・検証補助として扱う。
- Permission Set や Profile を更新するときは、意図しない権限差分が混ざっていないか確認する。

retrieve の具体的な事前確認と差分確認は [メタデータ取得](../deployment/salesforce-org-metadata-retrieve-rules.md) に従います。

## 検証

メタデータを変更したら、[変更チェックリスト](change-checklist.md)、[Apex 開発ルール](apex-rules.md)、[Salesforce 組織への反映](../deployment/salesforce-org-deploy-rules.md) の方針に従います。

作業報告には次を含めます。

- 変更したメタデータ種別とファイル
- 依存確認の結果
- 実行した validate / deploy / test
- 対象 Salesforce 組織の alias
- 実行しなかった確認と、その理由
