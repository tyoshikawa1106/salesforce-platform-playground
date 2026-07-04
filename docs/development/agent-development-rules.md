# AIエージェント開発ルール

AI エージェントがこのリポジトリで開発作業を行うときの共通ルールです。
Apex、メタデータ、GitHub、デプロイなどの詳細は関連 docs に従います。

## 作業開始時

- `git status --short --branch` で現在ブランチと未コミット変更を確認する。
- 既存の未コミット変更はユーザーの作業として扱い、明示依頼なしに戻さない。
- 変更をコミットする作業で `main` にいる場合は、`codex/<summary>` の作業ブランチを作成してから変更する。
- 対象のタスクや Issue を確認し、変更範囲を狭く保つ。

## 変更前

- `force-app/main/default` 配下の関連ファイルを確認する。
- 変更がプロファイル、権限セット、カスタムオブジェクト、項目、Flow、入力規則に依存するか確認する。
- 関連する README、docs、テスト、manifest、設定ファイルを必要範囲で確認する。
- 変更種別に対応する knowledge / discussions に現在の判断基準がある場合は、実装前に確認する。
- コードや既存メタデータから確認できない仕様を推測で固定しない。

## 変更中

- 依頼されたタスクに必要なファイルだけを変更する。
- 組織固有の値、認証情報、ローカル認証状態、個人環境の値をリポジトリに入れない。
- `.env`、`.env.*`、秘密鍵、証明書、token、password、client secret などの実値を含み得るファイルを読まない。
- Apex、LWC、Aura のソースを編集する場合は 4 spaces インデントに合わせる。
- `npm install` など依存関係を変更・導入するコマンドは、明示確認してから実行する。
- Node.js version、npm 依存、品質チェック設定、CI workflow を変更する場合は、関連 docs と既存 CI の役割を確認し、設定間の不整合を残さない。

## Apex 変更

- `.cls` ファイルと対応する `-meta.xml` ファイルを一緒に追加・更新する。
- 振る舞いを変える場合は、対象を絞った Apex テストを追加・更新する。
- UI、Flow、API、非同期処理、静的解析抑止に関わる Apex アノテーションは、公開範囲や実行方式を変えるため、必要性と影響を確認してから使う。
- 開発中は必要に応じて関連テストを絞って実行する。

例:

```sh
sf apex run test --class-names MyClassTest --result-format human --synchronous
```

## メタデータ変更

- デプロイ対象のメタデータは `force-app/main/default` 配下に置く。
- タスクに必要なメタデータだけを取得する。
- 取得したメタデータはコミット前に確認する。特に権限や自動生成に見えるファイルに注意する。
- タスクで明示されていない限り、`package.xml` は一時的な取得・検証補助として扱う。
- 広い `package.xml` では過剰な場合は、対象 metadata type を絞った `*` manifest を用意して取得範囲を管理する。
- Settings の `false` を有効化候補として機械的に扱わない。ライセンス、Edition、依存設定、不可逆性、セキュリティ影響を確認してから小さく分けて検証する。
- Scratch Org、Salesforce 組織反映、`force-app` deployability の詳細は `docs/deployment/` と関連 knowledge docs に従う。

## docs / 設定変更

- docs を追加、移動、削除した場合は、`docs/index.md` から辿れるか確認する。
- 詳しい手順や判断基準は `docs/` に置き、`AGENTS.md` は短い共通ルールに保つ。
- 特定の個人ユーザー名を運用ルールや automation config に固定しない。
- GitHub Actions、Dependabot、branch protection などの GitHub 側設定を変える場合は、現在の repository state を確認してから別タスクで扱う。
- エージェント運用を GitHub Actions 化する場合は、まずエージェントルールで運用し、例外や停止条件が固まってから強制する。

## Salesforce 組織での検証

`sf project deploy preview` は標準の確認手段にしません。反映前は Git の差分確認と `sf project deploy validate` で確認します。

操作対象を確認します:

```sh
sf config get target-org
```

alias だけでは判断できない場合に限り、必要な範囲で `sf org display` を使います。

deploy、delete、retrieve、Apex test は現在接続されている Salesforce 組織に対してのみ実行します。明示依頼なしに `--target-org` 指定やデフォルト組織の切り替えで別組織へ反映しません。

メタデータを接続中の Salesforce 組織へ反映する作業では、反映前に検証します:

```sh
npm run sf:validate:dev
```

依頼範囲に接続中の Salesforce 組織への反映が含まれ、検証結果に問題がなければ反映します:

```sh
npm run sf:deploy:dev
```

`npm run sf:validate:dev` は Salesforce 組織への初回デプロイ / 再構築用の `manifest/rebuild-developer-org.xml` を使います。
変更範囲を狭く確認したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞って検証します。

Apex 変更を含む PR を作成する前に、関連する Apex テストを coverage 付きで実行し、作業報告に結果を含めます。コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、Apex テストは PR 作成前の確認にまとめます。

```sh
sf apex run test --class-names MyClassTest --code-coverage --result-format human
```

## 静的解析

PR の CI では Salesforce Code Analyzer を `npm run code-analyzer:ci` で実行します。
ローカルで事前確認する場合は次を実行します。

```sh
npm run code-analyzer
```

CI と同じ severity threshold まで確認する場合は次を実行します。

```sh
npm run code-analyzer:ci
```

`logs/code-analyzer/` 配下の解析結果ファイルは生成物なので Git 管理しません。出力先フォルダの扱いは `logs/code-analyzer/code-analyzer-guide.md` を参照します。

開発時に使う主要コマンドの役割は [ローカル開発コマンド](../knowledge/local-development-commands.md) を参照します。

## 変更後確認

- `git status --short` と `git diff --stat` で変更範囲を確認する。
- 必要に応じて `git diff` で、タスク外差分、秘密情報、組織固有値、広すぎる retrieve 差分が混ざっていないか確認する。
- `git ls-files --others --exclude-standard` で、ignore されていない生成物や一時ファイルが混ざっていないか確認する。
- docs、Markdown、設定ファイルを変更した場合は、対象ファイルに対して Prettier を実行または確認する。
- Apex、メタデータ、LWC、Aura など振る舞いに関わる変更では、関連する validate / deploy / test / 静的解析を実行する。
- 実行しない検証がある場合は、理由を作業報告に残す。

## 作業報告

- 変更したファイルと目的を報告する。
- 実行した validate / deploy / test / 静的解析と結果を報告する。
- Salesforce 組織操作を実行した場合は、対象組織の alias を報告する。
- 実行しなかった確認と、その理由を報告する。
- コミットした場合はコミット ID、未コミットの場合はその状態を報告する。
