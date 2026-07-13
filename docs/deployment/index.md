# 組織操作

Salesforce 組織へ操作を行う前に参照するルールと手順をまとめています。

| タイトル                                                                         | 概要                                         |
| -------------------------------------------------------------------------------- | -------------------------------------------- |
| [組織操作ルール](org-operation-rules.md)                                         | validate、deploy、retrieve、test の実行判断  |
| [CI メタデータ検証ルール](ci-metadata-validation-rules.md)                       | GitHub Actions の任意 validate 設定          |
| [メタデータ削除ルール](metadata-deletion-rules.md)                               | destructive changes の実行条件と復旧確認     |
| [テストデータ投入手順](test-data-import.md)                                      | 合成テストデータの投入とクリーンアップ       |
| [Scratch Org 再現ルール](scratch-org-rebuild-rules.md)                           | Scratch Org の作成、初期反映、確認           |
| [Scratch Org 再現の前提と設定](scratch-org-rebuild-reference.md)                 | Installed Package、alias、Scratch definition |
| [Scratch Org manifest 運用ルール](scratch-org-manifest-rules.md)                 | Scratch Org の retrieve / deploy scope       |
| [Scratch Org definition feature ルール](scratch-org-definition-feature-rules.md) | Scratch Org 作成時の features / settings     |
