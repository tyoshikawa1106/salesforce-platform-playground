# リポジトリ運用ルール

このリポジトリは、Apex と Salesforce メタデータを扱う Salesforce DX の playground です。

## 共通作業ルール

- 変更は依頼されたタスクの範囲に絞る。
- 既存の設計、命名、配置、テスト方針に合わせる。
- コードやメタデータから確認できない仕様を推測で固定しない。不明点は確認事項として残す。
- 作業開始時は `git status` と現在ブランチを確認し、既存の未コミット変更を把握する。
- 変更作業に入る前に、これから行う変更範囲、主な作業、確認方法を短く提示し、ユーザー確認を挟む。現状把握のための read-only 調査はこの確認前に行ってよい。
- 既存の未コミット変更はユーザーの作業として扱い、明示依頼なしに戻さない。
- 変更前に関連する実装、テスト、README、docs を必要範囲で確認する。

## GitHub 運用

- 次タスクを提案・判断するときは、会話履歴や記憶より現在の repo / GitHub 状態を優先し、必要に応じて open Issue / PR も確認する。
- GitHub Flow で進め、`main` へ直接コミットしない。ブランチ、コミット、PR、リリースノートの詳細は `docs/development/github-rules.md` に従う。
- Issue、PR、コミット本文では、実ユーザー名のメールアドレスや org 固有のユーザー名を書かない。
- コミット時の hook は原則通す。失敗した場合、依存導入や `--no-verify` は明示確認してから行う。
- ローカルコミット後に一度停止し、push、PR 作成、CI 確認、merge はユーザーが明示した場合のみ進める。
- Salesforce メタデータ変更を含む PR は、merge 前に現在の default target org を確認し、確認済みの alias で validate する。
- Salesforce メタデータ変更を含む PR の merge を依頼された場合は、merge 後に同期した clean な `main` から、PR の deploy 可能な変更をすべて含む scope で確認済みの default target org へ実 deploy し、deploy 成功までタスクを完了扱いにしない。scope と例外は `docs/deployment/salesforce-org-operation-rules.md` に従う。
- PR マージ後の `main` 同期とマージ済み作業ブランチ削除は、`docs/development/github-rules.md` の条件を満たす場合は自動実行してよい。

## 安全・秘密情報

- 特定の個人ユーザー名を運用ルールや automation config に固定しない。
- コミット本文、検証ログ、作業報告では、実ユーザー名のメールアドレスや org 固有のユーザー名を書かない。
- コードコメント、docs、コミット本文、作業報告には、会話ログ、依頼文、作業中のやり取りをそのまま残さず、必要な目的・判断・検証結果だけを記録する。
- 秘密情報、認証ファイル、組織固有の一時ファイル、個人環境の値をコミットしない。
- `.env`、`.env.*`、秘密鍵、証明書、token、password、client secret などの実値を含み得るファイルを読まない。
- `npm install` など依存関係を変更・導入するコマンドは、明示確認してから実行する。

## Salesforce 固有

- 振る舞いを変える前に、既存メタデータ、権限、組織前提を確認する。
- デプロイ対象のメタデータは `force-app/main/default` を基準にする。
- Apex、メタデータ、Salesforce 組織操作、Apex test の詳細手順は `docs/development/agent-development-rules.md`、`docs/development/apex-rules.md`、`docs/development/metadata-rules.md`、`docs/deployment/` に従う。
- `forcedotcom/sf-skills` は Salesforce 関連作業の参考情報として使い、このリポジトリ固有の判断は `AGENTS.md` と `docs/` を優先する。
- Apex、LWC、Aura のソースを編集する場合は 4 spaces インデントに合わせ、インストール済み・生成済みファイルは整形目的で変更しない。
- メタデータ変更後は、変更ファイルと実行した deploy / 検証 / テストコマンドを報告する。

## ドキュメント

- ドキュメント配置は `docs/development/documentation-rules.md` に従う。
- このファイルは短く保つ。実務手順は `docs/development/` または `docs/deployment/` に置く。

## 検証

- Salesforce メタデータ変更後は、該当するルール文書に従い、実行した validate / deploy / test と対象組織を報告する。
