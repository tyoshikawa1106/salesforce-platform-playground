# リポジトリ運用ルール

このリポジトリは、Apex と Salesforce メタデータを扱う Salesforce DX の playground です。

## 作業ルール

- 変更は依頼された Issue やタスクの範囲に絞る。
- GitHub Flow で進め、`main` へ直接コミットしない。
- ブランチ名は通常 `feature/<summary>`、Codex 作業では `codex/<summary>` とする。
- コミットメッセージと PR title は `<type>: <日本語summary>` 形式にする。
- 振る舞いを変える前に、既存メタデータ、権限、組織前提を確認する。
- 秘密情報、認証ファイル、組織固有の一時ファイル、個人環境の値をコミットしない。
- `npm install` など依存関係を変更・導入するコマンドは、明示確認してから実行する。
- デプロイ対象のメタデータは `force-app/main/default` を正本とする。
- 現在の Dev 組織には source tracking がないため、`sf project deploy preview` 前提で進めない。
- 接続済みの Salesforce 組織に対する deploy、delete、retrieve、test などの操作は、明示確認してから実行する。
- Salesforce 公式の `forcedotcom/sf-skills` は補助情報として使うが、このリポジトリ固有の判断は `AGENTS.md` と `docs/` を優先する。
- メタデータ変更後は、変更ファイルと実行した検証・テストコマンドを報告する。
- コミット時の hook は原則通す。失敗した場合、依存導入や `--no-verify` は明示確認してから行う。
- このファイルは短く保つ。実務手順は `docs/development/` または `docs/deployment/` に置く。

## 検証

- メタデータをデプロイする前に、原則 `sf project deploy validate --source-dir force-app` を実行する。
- Dev 組織へ反映する場合は `sf project deploy start --source-dir force-app` を使う。
- Apex クラスやトリガーを変更した後は、関連する Apex テストを実行する。
