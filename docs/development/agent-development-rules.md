# AI エージェント開発ルール

AI エージェントがこのリポジトリで開発作業を行うときの共通ルールです。
Apex、メタデータ、GitHub、デプロイなどの詳細は該当するルール文書に従います。

## 作業開始時

- `git status --short --branch` で現在ブランチと未コミット変更を確認する。
- 既存の未コミット変更はユーザーの作業として扱い、明示依頼なしに戻さない。
- 変更をコミットする作業で `main` にいる場合は、作業ブランチを作成してから変更する。
- 対象のタスクや Issue を確認し、変更範囲を狭く保つ。
- ブランチ名、コミット、PR の詳細は `docs/development/github-rules.md` に従う。

## 作業内容の確認ステップ

1. `git status`、現在ブランチ、関連ファイルや docs、Issue / PR 状態を read-only で確認する。
2. 変更範囲、主な作業、変更予定ファイルや metadata、確認コマンド、未確定の前提を短く提示する。
3. ユーザーが確認または進行を明示するまで、変更作業や外部状態変更を開始しない。
4. 確認後に作業範囲、対象 org、実行コマンド、リスクが変わる場合は、変更を続ける前に再確認する。

確認が必要な操作には、ファイル変更、コミット、push、PR 作成、merge、deploy、retrieve、delete、Apex test、data import など、作業ツリーや外部状態を変える操作が含まれます。

## 変更前

- Apex、LWC、Aura、Salesforce メタデータを変更する場合は、`force-app/main/default` 配下の関連ファイルを確認する。
- Flow、LWC、Aura、Visualforce、Apex Trigger、Batch、Scheduler の振る舞いを変更する場合は、[機能仕様書ルール](specification-rules.md) と対応する主仕様書、詳細仕様を確認する。
- 変更がプロファイル、権限セット、カスタムオブジェクト、項目、Flow、入力規則に依存するか確認する。
- 関連する README、docs、テスト、manifest、設定ファイルを必要範囲で確認する。
- コードや既存メタデータから確認できない仕様を推測で固定しない。

## 変更中

- 依頼されたタスクに必要なファイルだけを変更する。
- 組織固有の値、認証情報、ローカル認証状態、個人環境の値をリポジトリに入れない。
- `.env`、`.env.*`、秘密鍵、証明書、token、password、client secret などの実値を含み得るファイルを読まない。
- Apex、LWC、Aura のソースを編集する場合は 4 spaces インデントに合わせる。
- `npm install` など依存関係を変更・導入するコマンドは、明示確認してから実行する。
- `package-lock.json` は手編集しない。`package.json` を変えた場合は npm で更新された lockfile 差分を確認する。
- npm 依存の major update は、peer dependency が成立する組み合わせで確認する。`--force` や `--legacy-peer-deps` で未対応の組み合わせを通さない。
- Node.js version、npm 依存、品質チェック設定、CI workflow を変更する場合は、`.node-version`、`package.json`、CI、setup docs の不整合を残さない。

## Apex 変更

- `.cls` ファイルと対応する `-meta.xml` ファイルを一緒に追加・更新する。
- 振る舞いを変える場合は、対象を絞った Apex テストを追加・更新する。
- UI、Flow、API、非同期処理、静的解析抑止に関わる Apex アノテーションは、公開範囲や実行方式を変えるため、必要性と影響を確認してから使う。
- 開発中は必要に応じて関連テストを絞って実行する。

例:

```sh
sf apex run test --class-names MyClassTest --result-format human --synchronous --target-org <alias>
```

## LWC / UI 変更

- LWC を追加・変更する場合は、DOM、イベント、Apex / wire mock、空状態、エラー状態のうち変更に関係する振る舞いを Jest で確認する。
- 画面上の操作要素を追加・変更する場合は、識別できるラベル、キーボード操作、aria 属性の必要性を確認する。
- 重要な LWC test では、automatic checks に頼らず、対象 DOM に明示的な `toBeAccessible()` assertion を追加する。

## メタデータ変更

- デプロイ対象のメタデータは `force-app/main/default` 配下に置く。
- 取得したメタデータはコミット前に確認する。特に権限や自動生成に見えるファイルに注意する。
- retrieve / 作業対象 catalog、Git 管理対象、deploy scope の扱いは `docs/development/metadata-rules.md` に従う。
- Settings の `false` を有効化候補として機械的に扱わない。ライセンス、Edition、依存設定、不可逆性、セキュリティ影響を確認してから小さく分けて検証する。
- Scratch Org と Salesforce 組織反映の詳細は `docs/deployment/` に従う。

## テストデータ / seed 変更

- org に投入する seed data には、実在の個人情報、顧客情報、秘密情報、org 固有 ID を入れない。
- seed を追加・変更する場合は、`docs/deployment/test-data-import.md` に従い、投入前に dry-run、cleanup 方針、対象 org の前提を確認する。

## docs / 設定変更

- docs を追加、移動、削除した場合は、`docs/index.md` から辿れるか確認する。
- 詳しい手順や判断基準は `docs/` に置き、`AGENTS.md` は短い共通ルールに保つ。
- 特定の個人ユーザー名を運用ルールや automation config に固定しない。
- GitHub Actions、Dependabot、branch protection などの GitHub 側設定を変える場合は、現在の repository state を確認してから別タスクで扱う。
- エージェント運用を GitHub Actions 化する場合は、まずエージェントルールで運用し、例外や停止条件が固まってから強制する。

## Salesforce 組織での検証

Salesforce 組織に対する操作では、対象 org、scope、preflight、報告内容を取り違えないよう、次の文書に従います。

| 操作                                                          | 参照先                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 接続中の組織に対する validate / deploy / retrieve / Apex test | [Salesforce 組織操作ルール](../deployment/salesforce-org-operation-rules.md)                 |
| metadata の delete                                            | [Salesforce メタデータ削除ルール](../deployment/salesforce-org-destructive-changes-rules.md) |
| data import                                                   | [テストデータ投入手順](../deployment/test-data-import.md)                                    |
| Scratch Org の作成・再現                                      | [Scratch Org 再現ルール](../deployment/scratch-org-rebuild-rules.md)                         |

Apex 変更を含む PR を作成する前に、関連する Apex テストを coverage 付きで実行し、作業報告に結果を含めます。
コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、Apex テストは PR 作成前の確認にまとめます。

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

## 変更後確認

- `git status --short` と `git diff --stat` で変更範囲を確認する。
- 必要に応じて `git diff` で、タスク外差分、秘密情報、組織固有値、広すぎる retrieve 差分が混ざっていないか確認する。
- `git ls-files --others --exclude-standard` で、ignore されていない生成物や一時ファイルが混ざっていないか確認する。
- docs、Markdown、設定ファイルを変更した場合は、対象ファイルに対して Prettier を実行または確認する。
- docs を追加、移動、分割した場合は、`npm run docs:check` でリンク、見出し、ファイル名、索引からの到達性を確認する。
- Flow、LWC、Aura、Visualforce、Apex Trigger、Batch、Scheduler の振る舞いを変更した場合は、対応する機能仕様書を同じ変更で更新し、`npm run docs:check` で実装との対応を確認する。
- Apex、メタデータ、LWC、Aura など振る舞いに関わる変更では、関連する validate / deploy / test / 静的解析を実行する。
- 実行しない検証がある場合は、理由を作業報告に残す。

## 作業報告

- 変更したファイルと目的を報告する。
- 実行した validate / deploy / test / 静的解析と結果を報告する。
- Salesforce 組織操作を実行した場合は、対象組織の alias を報告する。
- 実行しなかった確認と、その理由を報告する。
- コミットした場合はコミット ID、未コミットの場合はその状態を報告する。
