# ローカル開発コマンド

このページは、ローカル開発と確認で使う主要コマンドの役割をまとめます。依存追加、Salesforce 組織操作、deploy / retrieve / delete は、作業範囲と対象 org を確認してから実行します。

## 状態確認

| コマンド                                   | 役割                                     | 補足                                                      |
| ------------------------------------------ | ---------------------------------------- | --------------------------------------------------------- |
| `git status --short --branch`              | 現在ブランチと未コミット変更を確認する。 | 作業開始時と検証後に実行する。                            |
| `git diff --stat`                          | 差分の広がりを確認する。                 | retrieve や formatter 実行後の意図しない更新確認に使う。  |
| `git diff`                                 | 実際の変更内容を確認する。               | 秘密情報、org 固有値、タスク外差分がないか見る。          |
| `git ls-files --others --exclude-standard` | Git 管理対象外の通常ファイルを確認する。 | ignore されていない生成物や一時ファイルの混入を確認する。 |

## npm / 品質確認

| コマンド                                                | 役割                                             | 補足                                                               |
| ------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `npm ci`                                                | `package-lock.json` に固定された依存を再現する。 | 依存導入系なので、作業ルールに従って実行判断する。                 |
| `npm run prettier:verify`                               | Apex、metadata、docs、LWC などの整形を確認する。 | ファイルは書き換えない。                                           |
| `npm run docs:check`                                    | docs の構造とローカルリンクを確認する。          | 見出し、ファイル名、`docs/index.md` からの到達性も確認する。       |
| `npm run prettier`                                      | 対象ファイルを Prettier で整形する。             | 実行後は `git diff` で意図しない差分を確認する。                   |
| `npm run lint -- --no-error-on-unmatched-pattern`       | Aura / LWC JavaScript を ESLint で確認する。     | 対象ファイルがない場合も CI と同じく成功扱いにする。               |
| `npm run test:unit -- -- --runInBand --passWithNoTests` | LWC Jest を CI に近い形で実行する。              | LWC 変更時は関連テストを優先してから全体確認する。                 |
| `npm audit --omit=dev`                                  | production dependency の脆弱性を確認する。       | devDependency まで含める判断は作業内容に合わせる。                 |
| `npm run code-analyzer:ci`                              | Salesforce Code Analyzer を CI 相当で実行する。  | 結果は `logs/code-analyzer/ci.json` に出る。生成物は ignore 対象。 |

## Salesforce CLI

| コマンド                                                                                            | 役割                                                                                                                | 補足                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `sf --version`                                                                                      | Salesforce CLI のバージョンを確認する。                                                                             | ローカル環境の切り分けに使う。                                                                                                     |
| `sf config get target-org`                                                                          | 現在の default target org alias を確認する。                                                                        | org 詳細や認証情報を広く出さずに対象確認できる。                                                                                   |
| `sf org login web --set-default --alias dev`                                                        | Salesforce 組織へ Web ログインする。                                                                                | 明示依頼なしに default target org を切り替えない。                                                                                 |
| `npm run sf:validate:dev -- --target-org <alias>`                                                   | Production 組織または実行確認済みの Developer Edition の Dev 組織への初回デプロイ / 再構築 scope で validate する。 | `manifest/rebuild-developer-org.xml` を使う。Sandbox と Scratch Org では同じ scope の `sf project deploy start --dry-run` を使う。 |
| `npm run sf:deploy:dev -- --target-org <alias>`                                                     | Salesforce 組織へ初回デプロイ / 再構築 scope を deploy する。                                                       | validate 結果と対象 org を確認してから実行する。必要に応じて scope を絞る。                                                        |
| `sf project retrieve start --manifest <path> --target-org <alias>`                                  | manifest に基づいて metadata を retrieve する。                                                                     | 実行後は `git status --short`、`git diff --stat`、`git diff` を確認する。                                                          |
| `sf apex run test --class-names <names> --code-coverage --result-format human --target-org <alias>` | Apex test を絞って実行する。                                                                                        | Apex 変更時は関連テストを優先する。                                                                                                |

## データ準備

| コマンド                                              | 役割                                        | 補足                                        |
| ----------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `npm run setup:data:standard:dry-run`                 | 標準テストデータ import の計画を確認する。  | 実データ投入前の確認に使う。                |
| `npm run setup:data:standard -- --target-org <alias>` | 標準テストデータを対象 org に import する。 | 対象 org と投入範囲を確認してから実行する。 |
| `npm run data:bulk:results`                           | Bulk API 2.0 ingest job の結果を取得する。  | 結果は `logs/data-bulk-results/` に出る。   |

## 使い分け

- docs / config だけの変更では、まず `npm run prettier:verify` と差分確認を行う。
- LWC を含む変更では、Prettier、lint、LWC Jest を実行する。
- Apex / metadata を含む変更では、Code Analyzer、関連 Apex test、必要な validate を実行する。
- retrieve 後は CLI の表示だけで判断せず、Git 差分を基準にして意図しない更新を確認する。
