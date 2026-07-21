# AI エージェント開発ルール

AI エージェントがこのリポジトリで開発作業を行うときの共通ルールです。
Apex、メタデータ、GitHub、デプロイなどの詳細は該当するルール文書に従います。

## 適用する詳細ルール

この文書を共通の作業順序として使用し、変更内容に応じて次の詳細ルールを併用します。

| 作業内容                               | 詳細ルール                                                           |
| -------------------------------------- | -------------------------------------------------------------------- |
| Apex クラス、Trigger、Apex test        | [Apex 開発ルール](apex-rules.md)                                     |
| metadata の取得、編集、Git 管理        | [メタデータ管理ルール](metadata-rules.md)                            |
| 機能仕様書の追加、更新、棚卸し         | [機能仕様書ルール](specification-rules.md)                           |
| ブランチ、コミット、PR、マージ         | [GitHub 運用ルール](github-rules.md)                                 |
| Issue、Project、Milestone、Release、CI | [リポジトリ固有 GitHub 運用ルール](github-repository-rules.md)       |
| validate、deploy、retrieve、test       | [組織操作ルール](../deployment/org-operation-rules.md)               |
| metadata の削除                        | [メタデータ削除ルール](../deployment/metadata-deletion-rules.md)     |
| Scratch Org の作成、再現               | [Scratch Org 再現ルール](../deployment/scratch-org-rebuild-rules.md) |
| テストデータ投入                       | [テストデータ投入手順](../deployment/test-data-import.md)            |

複数の作業内容に該当する場合は、関連するルールをすべて適用します。詳細ルール間で判断が分かれる場合は、より対象を限定した文書を優先し、解消できない場合は変更前に確認します。

## 作業開始時

- `git status --short --branch` で現在ブランチと未コミット変更を確認する。
- 既存の未コミット変更はユーザーの作業として扱い、明示依頼なしに戻さない。
- 変更をコミットする作業で `main` にいる場合は、作業ブランチを作成してから変更する。
- 対象のタスクや Issue を確認し、変更範囲を狭く保つ。
- ブランチ、コミット、PRの共通手順は`docs/development/github-rules.md`、このリポジトリ固有のGitHub運用は`docs/development/github-repository-rules.md`に従う。

## 作業内容の確認ステップ

1. `git status`、現在ブランチ、関連ファイルや docs、Issue / PR 状態を read-only で確認する。
2. 変更範囲、主な作業、変更予定ファイルや metadata、確認コマンド、未確定の前提を短く提示する。
3. ユーザーが確認または進行を明示するまで、変更作業や外部状態変更を開始しない。
4. 確認後に作業範囲、対象 org、実行コマンド、リスクが変わる場合は、変更を続ける前に再確認する。

確認が必要な操作には、ファイル変更、コミット、プッシュ、PR 作成、マージ、deploy、retrieve、delete、Apex test、data import など、作業ツリーや外部状態を変える操作が含まれます。

## 変更前

- Apex、LWC、Aura、Salesforce メタデータを変更する場合は、`force-app/main/default` 配下の関連ファイルを確認する。
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

## コードコメント

- リポジトリで独自実装する開発コードのコメントは日本語で書く。API 名、クラス名、項目名、コマンド、ディレクティブなどの識別子は元の表記を維持する。
- コメントは識別子や構文の言い換えではなく、処理の目的、成立させる状態、判断理由、呼び出し後に可能になることを書く。
- 同じ説明が繰り返される場合は、共通処理への集約や責務の分割を先に検討し、重複したコードをコメントで補わない。
- lint ディレクティブ、ツールが解釈するコメント、インストール済みファイル、生成済みファイルは、通常の日本語コメント規約の対象外とする。
- Apex のコメント密度と形式は [Apex 開発ルール](apex-rules.md) に従い、必要な箇所へ ApexDoc または通常コメントを記載する。

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

### JavaScript 構成

- 本節の画面 LWC は、Lightning ページなどへ公開する LWC、またはデータ取得、利用者操作から結果表示までの処理順序、複数の画面状態、子コンポーネント間の連携を制御する Controller 相当の LWC を指す。
- 新規に独自実装する画面 LWC は、`componentName.js` と `componentNameLogic.js` の 2 層構成を必須とする。
- 親から受け取った値の表示、または利用者操作の親への通知だけを担当し、画面単位の処理を制御しない内部子 LWC は表示部品として扱い、この 2 層構成の対象外とする。処理量が少ないことだけを理由に、画面 LWC を対象外にしない。
- 既存の画面 LWC の振る舞いを変更する場合は、変更行だけでなく bundle 全体を 2 層構成へ合わせる。構成だけを合わせる一括変更は、機能変更と分離した明示タスクで行う。
- `componentName.js` は Controller として、`@api`、`@wire`、ライフサイクル、イベント受付、LWC 固有 API、処理順序、成功・失敗時の分岐、画面状態への反映を担当する。このファイルを読めば、利用者の操作から結果表示までの主要な流れを追える状態にする。
- `componentNameLogic.js` は、データ変換、判定、正規化、リクエスト生成、状態遷移、表示値生成など、LWC インスタンスに依存しない UI ロジックを担当し、原則として入力から結果を返す純粋関数で構成する。
- Logic へ `this`、コンポーネントインスタンス、DOM 要素を渡さない。wire adapter、imperative Apex、Toast、Navigation、`refreshApex`、DOM 操作などの LWC 固有処理は `componentName.js` に残す。
- メイン処理の大枠を Logic へ隠さず、単純な代入、直接的な真偽値判定、状態リセット、呼び出しを移しただけの多段ラッパーを作らない。これらは画面フローの一部として `componentName.js` に残す。
- Logic には、複数の入力を組み合わせるデータ変換、表示モデル、リクエスト、状態遷移など、画面単位の結果を生成し、単独でテストする意味のある処理を置く。
- Logic は `componentNameLogic.js` にまとめることを基本とする。複数の独立した責務があり、1 ファイルでは処理を追いにくい場合だけ、責務別 JavaScript へ追加分割する。
- 既存・新規を問わず、責務と依存関係から統合または分割を判断する。既存ファイルを残すことや、命名を揃えること自体を判断理由にしない。
- 追加分割する場合も、`componentNameLogic.js` をメイン JavaScript から参照する画面単位のロジック入口とし、詳細モジュールの結果を画面単位へ組み立てる。単なる再 export、多段ラッパー、循環 import を作らない。
- ページレイアウト解析や大きな配列変換など、処理量の大きい派生状態を複数の getter から繰り返し生成しない。入力変更時の再生成、適切なキャッシュ、軽量状態との分離から、依存関係に合う方法を選ぶ。
- 派生状態をコンポーネントに保持する場合は、元になる状態と wire 応答を明確にし、すべての変更経路で再生成する。処理中や表示中など頻繁に変わる単純状態は、保持済みの派生状態とメイン JavaScript で合成する。
- 複数の LWC で共有する処理は、コンポーネント固有の Logic に重複させず、再利用範囲を確認して API module への昇格を検討する。
- 権限、データ整合性、業務上必須の制約など、LWC を経由しない更新でも守る必要があるルールは Apex または Salesforce メタデータ側で担保する。
- Logic の分岐、変換、状態遷移は Logic を直接 import する Jest test で確認する。派生状態を保持する場合は、元の状態と wire 応答の変更後に再生成されることも確認する。メイン JavaScript とテンプレートの接続はコンポーネントの Jest test で確認する。
- 表示部品、API module、CSS module、テスト用 mock、インストール済み・生成済みコンポーネントは、この 2 層構成の対象外とする。

構成を決めた背景と懸念への対策は、[LWC JavaScript 構成](../discussions/lwc-javascript-structure.md)に記録します。

### JavaScript 実装コメント

- `force-app/main/default/lwc` 配下で独自実装する本体 JavaScript は、新規行や変更行だけでなくファイル全体を対象にコメント規約へ合わせる。
- 宣言、代入、分岐、返却、呼び出し、データ変換など、意味を持つコード行ごとに、目的または成立させる状態を示す短い日本語コメントを直前へ 1 行ずつ記載する。
- 1 行のコメントは直後の 1 つの処理を説明する。複数行の式やオブジェクト定義では、式全体の目的に加え、個別プロパティの役割が画面や状態管理の理解に必要な場合だけ各行へ補足する。
- import、デコレータ、空行、括弧や閉じ記号だけの行、複数行式の継続行は、1 行ごとの日本語コメントの対象外とする。
- LWC の Jest test は 1 行ごとのコメント対象外とするが、テスト内に説明コメントを書く場合は日本語にする。
- コメント追加によって同じ状態更新や説明が繰り返される場合は、共通関数へ集約してからコメントを付ける。

### テストと UI

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
- seed を追加・変更する場合は、`docs/deployment/test-data-import.md` に従い、投入前に dry-run、クリーンアップ方針、対象 org の前提を確認する。

## docs / 設定変更

- docs を追加、移動、削除した場合は、`docs/index.md` から辿れるか確認する。
- 詳しい手順や判断基準は `docs/` に置き、`AGENTS.md` は短い共通ルールに保つ。
- 特定の個人ユーザー名を運用ルールや automation config に固定しない。
- GitHub Actions、Dependabot、ブランチ保護などの GitHub 側設定を変える場合は、現在のリポジトリの状態を確認してから別タスクで扱う。
- エージェント運用を GitHub Actions 化する場合は、まずエージェントルールで運用し、例外や停止条件が固まってから強制する。

## Salesforce 組織での検証

Salesforce 組織に対する操作では、対象 org、scope、事前検証、報告内容を取り違えないよう、次の文書に従います。

| 操作                                                          | 参照先                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| 接続中の組織に対する validate / deploy / retrieve / Apex test | [組織操作ルール](../deployment/org-operation-rules.md)               |
| metadata の delete                                            | [メタデータ削除ルール](../deployment/metadata-deletion-rules.md)     |
| data import                                                   | [テストデータ投入手順](../deployment/test-data-import.md)            |
| Scratch Org の作成・再現                                      | [Scratch Org 再現ルール](../deployment/scratch-org-rebuild-rules.md) |

Apex 変更を push する前に、関連する Apex テストを coverage 付きで実行し、作業報告に結果を含めます。
コメントやインデントだけの Apex 変更では、`git diff -w` などで振る舞い差分がないことを確認し、Apex テストは push 前の確認にまとめます。

## 静的解析

PR の CI では SLDS Linter を `npm run lint:slds`、Salesforce Code Analyzer を `npm run code-analyzer:ci` で実行します。

- Code Analyzer、ESLint、その他の静的解析について、ユーザーの明示的な許可なしに suppression、除外設定、対象範囲の縮小、severity threshold の緩和を追加または拡大しない。
- 解析結果は suppression 適用後の件数だけを報告せず、抑止された違反がある場合は、その件数、対象 rule、対象ファイルを明示する。無効化した rule がある場合も、rule 名と理由を明示する。
- 違反は、まずコードまたは設計で解消する。解消できない場合も suppression を既定の対応にせず、理由と影響を提示してユーザーの判断を待つ。

ローカルで事前確認する場合は次を実行します。

```sh
npm run lint:slds
npm run code-analyzer
```

SLDS Linterは`force-app/main/default/lwc`配下のHTMLとCSSを対象にし、ローカルとCIで同じnpm scriptを使います。

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
- Markdown を変更した場合は、`npm run docs:check` でローカルリンク、見出し、ファイル名、索引からの到達性を確認する。
- 外部リンクを追加・更新した場合は、`npm run docs:check:external` でリンク先を確認する。アクセス拒否、レート制限、通信失敗の警告は、自動的にリンク切れと扱わず、必要に応じてブラウザまたは別の方法で再確認する。
- 振る舞いを変更した場合は [機能仕様書ルール](specification-rules.md) に従って仕様影響を判定し、影響がある現行実装仕様を原則として同じ変更単位で更新する。
- ユーザーから機能仕様書の一括更新を依頼された場合は、独自実装した開発機能を対象に、実装、仕様、既知の差異を棚卸しする。Salesforce 設定全体の仕様書は作成しない。
- Apex、metadata、LWC、Aura などの振る舞いを変更した場合は、[組織操作ルール](../deployment/org-operation-rules.md#開発中の動作確認-deploy) に従って限定 scope を開発 org へ deploy し、org 上で動作確認する。最終的な validate / dry-run、test、静的解析は、[push 前の検証](../deployment/org-operation-rules.md#push-前の検証)にまとめて実行する。
- 実行しない検証がある場合は、理由を作業報告に残す。

## 作業報告

- 変更したファイルと目的を報告する。
- 実行した validate / deploy / test / 静的解析と結果を報告する。
- Salesforce 組織操作を実行した場合は、対象組織の alias を報告する。
- 実行しなかった確認と、その理由を報告する。
- コミットした場合はコミット ID、未コミットの場合はその状態を報告する。
