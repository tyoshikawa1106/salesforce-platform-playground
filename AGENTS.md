# リポジトリ運用ルール

このリポジトリは、Apex と Salesforce メタデータを扱う Salesforce DX の playground です。

## 作業ルール

- 変更は依頼された Issue やタスクの範囲に絞る。
- 既存の設計、命名、配置、テスト方針に合わせる。
- コードやメタデータから確認できない仕様を推測で固定しない。不明点は確認事項として残す。
- 作業開始時は `git status` と現在ブランチを確認し、既存の未コミット変更を把握する。
- 変更作業に入る前に、これから行う変更範囲、主な作業、確認方法を短く提示し、ユーザー確認を挟む。現状把握のための read-only 調査はこの確認前に行ってよい。
- 次タスクを提案・判断するときは、会話履歴や記憶より現在の repo / GitHub 状態を優先し、必要に応じて open Issue / PR も確認する。
- 既存の未コミット変更はユーザーの作業として扱い、明示依頼なしに戻さない。
- 変更前に関連する実装、テスト、README、docs を必要範囲で確認する。
- GitHub Flow で進め、`main` へ直接コミットしない。
- コミット前に現在ブランチを確認し、`main` にいる場合は必ず作業ブランチを作成してからコミットする。
- ブランチ名は通常 `feature/<summary>`、Codex 作業では `codex/<summary>` とする。
- コミットメッセージと PR title は `<type>: <日本語summary>` 形式にする。
- 実質的な変更のコミットには、目的、主な変更、検証結果を本文に記載する。
- エージェントが PR を作成する場合は、対応する実在 Issue を必ず `Closes #<issue番号>` で紐づける。対応 Issue がない場合は、PR 作成前に Issue を作成するかユーザーに確認する。
- GitHub の Issue / PR はテンプレートに従い、ラベル、assignee、Project 紐づけなどの詳細運用は `docs/development/github-rules.md` に従う。
- リリースノートは GitHub Release を正本とし、日次リリースの作成手順は `docs/development/github-rules.md` に従う。
- 特定の個人ユーザー名を運用ルールや automation config に固定しない。
- Issue、PR、コミット本文、検証ログの記録では、実ユーザー名のメールアドレスや org 固有のユーザー名を書かない。
- 振る舞いを変える前に、既存メタデータ、権限、組織前提を確認する。
- 秘密情報、認証ファイル、組織固有の一時ファイル、個人環境の値をコミットしない。
- `.env`、`.env.*`、秘密鍵、証明書、token、password、client secret などの実値を含み得るファイルを読まない。
- `npm install` など依存関係を変更・導入するコマンドは、明示確認してから実行する。
- デプロイ対象のメタデータは `force-app/main/default` を正本とする。
- Salesforce 組織に対する deploy、delete、retrieve、test、data import などの操作は、対象 org の alias を確認し、依頼範囲内でのみ `--target-org <alias>` を明示して実行する。明示依頼なしに default target org を切り替えない。
- Scratch Org の作成と削除は、ユーザーの明示依頼がある場合のみ実行する。動作確認後も勝手に削除しない。
- Scratch Org を作成した場合は、ユーザーが別途指示しない限り、Scratch Org 用の標準 deploy 手順まで実施してから報告する。
- `sf project deploy preview` 前提で進めず、差分確認と validate を標準の確認手段にする。
- Apex、メタデータ、deploy、retrieve、delete、Apex test の詳細手順は `docs/development/agent-development-rules.md`、`docs/development/apex-rules.md`、`docs/development/metadata-rules.md`、`docs/deployment/` に従う。
- `forcedotcom/sf-skills` は Salesforce 関連作業の補助情報として使い、このリポジトリ固有の判断は `AGENTS.md` と `docs/` を優先する。
- ドキュメント配置は `docs/development/documentation-rules.md` に従う。
- Apex、LWC、Aura のソースを編集する場合は 4 spaces インデントに合わせ、インストール済み・生成済みファイルは整形目的で変更しない。
- メタデータ変更後は、変更ファイルと実行した deploy / 検証 / テストコマンドを報告する。
- コミット時の hook は原則通す。失敗した場合、依存導入や `--no-verify` は明示確認してから行う。
- ローカルコミット後に一度停止し、push、PR 作成、CI 確認、merge はユーザーが明示した場合のみ進める。
- PR マージ後の `main` 同期とマージ済み作業ブランチ削除は、`docs/development/github-rules.md` の条件を満たす場合は自動実行してよい。
- このファイルは短く保つ。実務手順は `docs/development/` または `docs/deployment/` に置く。

## 検証

- Salesforce メタデータ変更後は、関連 docs に従い、実行した validate / deploy / test と対象組織を報告する。
