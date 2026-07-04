# メタデータ開発ルール

Salesforce メタデータを追加・更新するときの実務ルールです。

## 基本方針

- デプロイ対象の正本は `force-app/main/default` 配下に置く。
- 変更対象に必要なメタデータだけを追加・取得する。
- 組織から retrieve したメタデータは、コミット前に差分を確認する。
- 広い manifest で retrieve した結果を、そのまま正本として扱わない。
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
- 広い `package.xml` では取得範囲が過剰な場合は、対象 metadata type を絞った `*` manifest を用意して取得範囲を管理する。
- Git 管理対象にする metadata type は、原則として type 単位で扱う。個別ファイルを部分選別する場合は、再現性が崩れない理由を確認する。
- Permission Set や Profile を更新するときは、意図しない権限差分が混ざっていないか確認する。
- Profile、Role、installed package、app menu、通知先、メール送信設定、My Domain、OAuth / SAML、外部 URL など、組織依存や機密情報を含み得る metadata は除外寄りに扱う。
- Settings を追加・更新する場合は、ユーザー名、My Domain、ライセンス、Edition、不可逆な有効化、セキュリティ影響を確認する。

retrieve の具体的な事前確認と差分確認は [Salesforce メタデータ取得ルール](../deployment/salesforce-org-metadata-retrieve-rules.md) に従います。

## 検証

メタデータを変更したら、[AIエージェント開発ルール](agent-development-rules.md)、[Apex 開発ルール](apex-rules.md)、[Salesforce 組織反映ルール](../deployment/salesforce-org-deploy-rules.md) の方針に従います。

作業報告には次を含めます。

- 変更したメタデータ種別とファイル
- 依存確認の結果
- 実行した validate / deploy / test
- 対象 Salesforce 組織の alias
- 実行しなかった確認と、その理由
