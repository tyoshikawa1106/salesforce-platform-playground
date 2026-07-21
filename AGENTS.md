# リポジトリ運用ルール

このリポジトリは、Salesforce開発プロジェクトを管理するリポジトリです。

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
- `main`へ直接コミットしない。共通手順は`docs/development/github-rules.md`、このリポジトリ固有のIssue、Project、Milestone、Release、CI運用は`docs/development/github-repository-rules.md`に従う。
- Issue、PR、コミット本文では、実ユーザー名のメールアドレスや org 固有のユーザー名を書かない。
- コミット時のフックは原則通す。失敗した場合、依存導入や `--no-verify` は明示確認してから行う。
- ローカルコミット後に一度停止し、プッシュ、PR 作成、CI 確認、マージはユーザーが明示した場合のみ進める。
- 組織反映を目的とする Salesforce メタデータ変更を含む PR は、push 前に現在の default target org と org 種別を確認し、確認済みの alias で対象 org に応じた validate または dry-run を実行する。docs-only と、org から取得した状態を記録するだけの retrieve-only 変更は対象外とする。
- Salesforce メタデータ変更を含む PR のマージ依頼は deploy の依頼を意味しない。PR マージ、`main` 同期、作業ブランチ整理までを GitHub 作業の完了範囲とし、同じフローでマージ後の deploy は行わない。本番 release など通常開発外の deploy は、明示された別タスクとして扱う。
- PR マージ後の `main` 同期とマージ済み作業ブランチ削除は、共通手順を `docs/development/github-rules.md`、自動実行条件を `docs/development/github-repository-rules.md` に従う。

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
- 開発中の動作確認 deploy と push 前の validate / dry-run は、Git 差分に含まれる deploy 可能な metadata と、動作に必要なことを明示した依存 metadata だけを対象にする。`force-app` 全体や org 再構築用 scope を通常開発へ流用しない。
- 振る舞いを変更した場合は、対象の開発 org の alias と org 種別、metadata の fullName、件数、差分外依存を提示し、その限定 scope の deploy が明示承認された後に開発 org へ deploy して、org 上で動作確認する。動作確認後に振る舞いへ影響する修正を行った場合は、scope を見直して再度 deploy と動作確認を行う。
- FlexiPage は、対象ファイルが依頼された変更差分に含まれ、かつ deploy 対象として明示されている場合だけ validate / deploy できる。
- 組織の初回構築または再構築は通常開発と分離し、ユーザーが明示した別タスクで、全対象を確認した個別承認がある場合だけ実行する。再利用可能な接続組織向け全体 deploy コマンドや manifest は管理しない。
- Apex、メタデータ、Salesforce 組織操作、Apex test の詳細手順は `docs/development/agent-development-rules.md`、`docs/development/apex-rules.md`、`docs/development/metadata-rules.md`、`docs/deployment/` に従う。
- `forcedotcom/sf-skills` は Salesforce 関連作業の参考情報として使い、このリポジトリ固有の判断は `AGENTS.md` と `docs/` を優先する。
- 振る舞いを変更した場合は `docs/development/specification-rules.md` に従って現行実装仕様への影響を判定し、影響がある仕様書を更新する。更新時期は対象実装の開発手順に従う。一括更新は独自実装した開発機能を対象とし、Salesforce 設定全体の仕様書は作成しない。
- Apex、LWC、Aura のソースを編集する場合は 4 spaces インデントに合わせ、インストール済み・生成済みファイルは整形目的で変更しない。
- メタデータ変更後は、変更ファイルと実行した deploy / 検証 / テストコマンドを報告する。

## ドキュメント

- ドキュメント配置は `docs/development/documentation-rules.md` に従う。
- このファイルは短く保つ。実務手順は `docs/development/` または `docs/deployment/` に置く。

## 検証

- Salesforce メタデータ変更後は、該当するルール文書に従い、実行した validate / deploy / test と対象組織を報告する。
