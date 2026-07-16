# force-app の deploy 対象棚卸し

`force-app/main/default`はSalesforce sourceの管理基準ですが、接続組織への一括deploy scopeではありません。

## 基本方針

- 通常開発では、Git差分に含まれるdeploy可能なmetadataと、動作に必要なことを明示した依存metadataだけをscopeにする。
- `--source-dir force-app`や全metadataを列挙したmanifestを通常開発、PR前validate、PRマージ後deployに使わない。
- retrieveしたorg固有metadataが混在するため、Git管理対象であることだけを理由にdeployしない。
- metadata type単位の安全性を、別typeや別タスクへ一般化しない。
- FlexiPage、Layout、権限、通知、共有、認証、組織設定は、差分と依頼範囲に含まれる場合だけ個別に扱う。

## Scopeへ含める条件

metadataをvalidate / deploy scopeへ含めるには、次をすべて満たす必要があります。

1. 対象ファイルが依頼されたGit差分に含まれる、または動作上必要な依存metadataである。
2. metadata typeとfullNameを列挙できる。
3. 差分外の依存metadataは、追加理由を説明できる。
4. 対象orgでの上書き影響を確認している。
5. validate / dry-runと実deployで同一scopeを再現できる。

一つでも満たさないmetadataはscopeへ含めません。

## 個別確認が必要な主なmetadata

| metadata                            | 主なリスク                           | 扱い                                                            |
| ----------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| FlexiPage / Layout                  | 組織内の画面編集を上書きする         | 対象ファイルが変更差分かつ依頼範囲にある場合だけ扱う            |
| Permission Set / Profile            | 権限の付与・剥奪                     | 差分と利用者への影響を確認する。Profileは原則として個別判断する |
| Settings                            | 組織機能やセキュリティ設定を変更する | 設定単位の明示依頼がある場合だけ扱う                            |
| Application / AppMenu               | 標準アプリや表示順へ影響する         | 対象アプリを限定する                                            |
| SharingRules / Role                 | データアクセスや組織体制へ影響する   | 専用タスクとして扱う                                            |
| Flow / FlowDefinition               | 自動処理の有効versionへ影響する      | 有効化方針を確認する                                            |
| AssignmentRules / AutoResponseRules | 担当割当やメール送信へ影響する       | 参照先と有効化状態を確認する                                    |
| RemoteSiteSetting / 認証関連        | 外部接続や秘密情報へ影響する         | 接続先と環境差を確認する                                        |

## 初回構築・再構築

接続組織の初回構築または再構築は、通常開発とは別タスクです。ユーザーの明示依頼と、全metadataのtype・fullName・件数・上書き影響・復旧方法を確認した個別承認が必要です。

初回構築用scopeはそのタスク内で一時的に作成し、通常開発から再利用できるnpm scriptや恒久的な接続組織向け全体manifestとして管理しません。

Scratch Orgの初期反映は、接続組織のdeployと分離して`manifest/rebuild-scratch-org.xml`とScratch Org専用ルールで管理します。

## 関連ページ

- [組織操作ルール](../deployment/org-operation-rules.md)
- [メタデータ管理ルール](../development/metadata-rules.md)
- [Scratch Org再現ルール](../deployment/scratch-org-rebuild-rules.md)
