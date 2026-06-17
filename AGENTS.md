# リポジトリ運用ルール

このリポジトリは、Apex と Salesforce メタデータを扱う Salesforce DX の playground です。

## 作業ルール

- 変更は依頼された Issue やタスクの範囲に絞る。
- 既存の設計、命名、配置、テスト方針に合わせる。
- コードやメタデータから確認できない仕様を推測で固定しない。不明点は確認事項として残す。
- 作業開始時は `git status` と現在ブランチを確認し、既存の未コミット変更を把握する。
- 既存の未コミット変更はユーザーの作業として扱い、明示依頼なしに戻さない。
- 変更前に関連する実装、テスト、README、docs を必要範囲で確認する。
- GitHub Flow で進め、`main` へ直接コミットしない。
- コミット前に現在ブランチを確認し、`main` にいる場合は必ず作業ブランチを作成してからコミットする。
- ブランチ名は通常 `feature/<summary>`、Codex 作業では `codex/<summary>` とする。
- コミットメッセージと PR title は `<type>: <日本語summary>` 形式にする。
- GitHub の Issue には必ずラベルを付け、運用は `docs/development/rules.md` のラベルルールに従う。
- GitHub の Issue と PR は、リポジトリのテンプレートに従って作成する。
- 振る舞いを変える前に、既存メタデータ、権限、組織前提を確認する。
- 秘密情報、認証ファイル、組織固有の一時ファイル、個人環境の値をコミットしない。
- `.env`、`.env.*`、秘密鍵、証明書、token、password、client secret などの実値を含み得るファイルを読まない。
- `npm install` など依存関係を変更・導入するコマンドは、明示確認してから実行する。
- デプロイ対象のメタデータは `force-app/main/default` を正本とする。
- 現在の Dev 組織には source tracking がないため、`sf project deploy preview` 前提で進めない。
- 接続済みの Salesforce 組織に対する deploy、delete、retrieve、test などの操作は、明示確認してから実行する。
- Salesforce 公式の `forcedotcom/sf-skills` は補助情報として使うが、このリポジトリ固有の判断は `AGENTS.md` と `docs/` を優先する。
- ドキュメント配置は `docs/development/documentation-rules.md` に従う。
- メタデータ変更後は、変更ファイルと実行した検証・テストコマンドを報告する。
- コミット時の hook は原則通す。失敗した場合、依存導入や `--no-verify` は明示確認してから行う。
- ローカルコミット後に一度停止し、push、PR 作成、CI 確認、merge はユーザーが明示した場合のみ進める。
- PR マージ後は、ユーザーの明示確認を得てから `main` に戻り、`git pull --ff-only` で同期し、マージ済み作業ブランチを削除する。
- このファイルは短く保つ。実務手順は `docs/development/` または `docs/deployment/` に置く。

## 検証

- メタデータをデプロイする前に、原則 `sf project deploy validate --source-dir force-app` を実行する。
- Dev 組織へ反映する場合は `sf project deploy start --source-dir force-app` を使う。
- Apex クラスやトリガーを変更した後は、関連する Apex テストを実行する。
