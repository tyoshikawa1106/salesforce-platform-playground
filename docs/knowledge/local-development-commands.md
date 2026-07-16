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

| コマンド                                                | 役割                                                               | 補足                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `npm ci`                                                | `package-lock.json` に固定された依存を再現する。                   | 依存導入系なので、作業ルールに従って実行判断する。                        |
| `npm run prettier:verify`                               | Apex、metadata、docs、LWC などの整形を確認する。                   | ファイルは書き換えない。                                                  |
| `npm run docs:check`                                    | docs、入口文書、ガイド、文書断片の構造とローカルリンクを確認する。 | docsではファイル名と索引到達性も確認する。                                |
| `npm run docs:check:external`                           | 同じ対象の外部リンクを確認する。                                   | HEAD / GETの両方が404 / 410なら失敗、アクセス拒否や通信失敗は警告とする。 |
| `npm run test:scripts`                                  | リポジトリ管理スクリプトの単体テストを実行する。                   | 文書検査やScratch Org補助スクリプトを変更した場合に実行する。             |
| `npm run prettier`                                      | 対象ファイルを Prettier で整形する。                               | 実行後は `git diff` で意図しない差分を確認する。                          |
| `npm run lint -- --no-error-on-unmatched-pattern`       | Aura / LWC JavaScript を ESLint で確認する。                       | 対象ファイルがない場合も CI と同じく成功扱いにする。                      |
| `npm run test:unit -- -- --runInBand --passWithNoTests` | LWC Jest を CI に近い形で実行する。                                | LWC 変更時は関連テストを優先してから全体確認する。                        |
| `npm audit --audit-level=high`                          | production / dev dependencyを監査する。                            | CIと同じくhigh / criticalを失敗条件にする。                               |
| `npm run code-analyzer:ci`                              | Salesforce Code Analyzer を CI 相当で実行する。                    | 結果は `logs/code-analyzer/ci.json` に出る。生成物は ignore 対象。        |

## Salesforce CLI

| コマンド                                                                                            | 役割                                                                                   | 補足                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `sf --version`                                                                                      | Salesforce CLI のバージョンを確認する。                                                | ローカル環境の切り分けに使う。                                                                                       |
| `sf config get target-org`                                                                          | 現在の default target org alias を確認する。                                           | org 詳細や認証情報を広く出さずに対象確認できる。                                                                     |
| `sf org login web --set-default --alias dev`                                                        | Salesforce 組織へ Web ログインする。                                                   | 明示依頼なしに default target org を切り替えない。                                                                   |
| `sf project deploy validate --metadata <type:fullName> --target-org <alias>`                        | Git差分と明示した依存metadataだけをDeveloper Editionなどでvalidateする。               | 実行前に対象fullNameと件数を提示し、実deployにも同じscopeを使う。                                                    |
| `sf project deploy start --metadata <type:fullName> --target-org <alias>`                           | validate済みの限定scopeを接続組織へdeployする。                                        | PRマージや通常のdeploy依頼を全体deployの許可として扱わない。                                                         |
| `npm run sf:destructive`                                                                            | default target orgに対するdestructive changesを実行する。                              | 対象組織を確認後にdry-runし、成功後の再確認で承認した場合だけ実削除する。                                            |
| `npm run sf:retrieve`                                                                               | VS Codeで現在接続している組織から、27個のscopeに分けた全metadataを順番にretrieveする。 | 表示されたdefault target orgを確認し、実行を承認した場合だけretrieveする。失敗した場合は、その時点で処理を終了する。 |
| `sf project retrieve start --manifest <path> --target-org <alias>`                                  | manifest に基づいて metadata を retrieve する。                                        | 実行後は `git status --short`、`git diff --stat`、`git diff` を確認する。                                            |
| `sf apex run test --class-names <names> --code-coverage --result-format human --target-org <alias>` | Apex test を絞って実行する。                                                           | Apex 変更時は関連テストを優先する。                                                                                  |

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
