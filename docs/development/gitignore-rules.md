# .gitignore 運用ルール

このリポジトリの `.gitignore` は、Salesforce 公式サンプルの `trailheadapps/dreamhouse-lwc` を基本形にし、リポジトリ固有のローカル生成物と Git 管理から外す Salesforce metadata を追加します。

## 基本方針

- Salesforce CLI、LWC、Node、OS、エディタが生成するローカルファイルはコミットしない。
- 秘密情報や個人環境の値が入り得る `.env` 系ファイルはコミットしない。
- 共有価値がある設定例やテンプレートは ignore しない。
- 成果物になり得るファイル拡張子は、用途が決まるまで広く ignore しない。
- Salesforce metadata は、メールアドレス、OAuth / SAML、認証・権限設定、個人情報を含み得る条件、org 固有 ID / ドメインを含むものを Git 管理から外す。
- Developer Org の機能状態や URL など、秘匿性が低く再現対象として扱える metadata は Git 管理対象にする。

## `.env` 系ファイル

| パターン       | 扱い                                        |
| -------------- | ------------------------------------------- |
| `.env`         | ignore する                                 |
| `.env.local`   | ignore する                                 |
| `.env.*.local` | ignore する                                 |
| `.env.example` | ignore しない。テンプレートとしてコミット可 |

`.env.*` をまとめて ignore すると `.env.example` まで隠れるため、このリポジトリでは local 系だけを対象にします。

## セクション別の管理対象

### Salesforce cache

| パターン              | 理由                                                            |
| --------------------- | --------------------------------------------------------------- |
| `.sf/`                | Salesforce CLI のローカル状態や認証情報を含み得る。             |
| `.sfdx/`              | 旧 Salesforce CLI / 互換ツールのローカル状態を含み得る。        |
| `.localdevserver/`    | LWC local dev server の生成物。                                 |
| `deploy-options.json` | Salesforce CLI / VS Code 由来のローカル deploy 設定として扱う。 |

### Salesforce metadata excluded from Git management

このセクションは、一時ファイルではなく、`force-app/main/default` に retrieve されてもこのリポジトリの Git 管理対象にしない Salesforce metadata を定義します。

| パターン                                                        | 理由                                                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `force-app/main/default/apexEmailNotifications/`                | Apex 例外通知先のメールアドレスを含み得る。                                                         |
| `force-app/main/default/assignmentRules/`                       | 割り当て先 User / Queue やメールアドレス形式のユーザー名を含み得る。                                |
| `force-app/main/default/autoResponseRules/`                     | 自動返信メールの送信設定やメール関連情報を含み得る。                                                |
| `force-app/main/default/cleanDataServices/`                     | Data.com / Clean 系の org 機能状態に依存するため、必要になった時点で個別判断する。                  |
| `force-app/main/default/escalationRules/`                       | ユーザー、キュー、BusinessHours、メール通知先に依存し得る。                                         |
| `force-app/main/default/externalClientApps/`                    | External Client App の OAuth / OIDC 連携設定。接続構成として高感度。                                |
| `force-app/main/default/extlClntAppGlobalOauthSets/`            | External Client App の OAuth 共通設定。callback URL、consumer key などを含み得る。                  |
| `force-app/main/default/extlClntAppOauthPolicies/`              | OAuth policy。client credentials flow user などを含み得る。                                         |
| `force-app/main/default/extlClntAppOauthSecuritySettings/`      | OAuth security 設定。認証構成として高感度。                                                         |
| `force-app/main/default/extlClntAppOauthSettings/`              | OAuth settings。oauthLink や接続構成を含み得る。                                                    |
| `force-app/main/default/extlClntAppPolicies/`                   | External Client App policy。org 状態と認証運用に依存する。                                          |
| `force-app/main/default/installedPackages/`                     | インストール済み package は source deploy ではなく `sf package install` 手順で扱う。                |
| `force-app/main/default/objects/*/listViews/`                   | ユーザーが設定する絞り込み条件に個人情報や顧客情報が含まれ得る。                                    |
| `force-app/main/default/profilePasswordPolicies/`               | Profile 別の password policy。認証防御設定として高感度。                                            |
| `force-app/main/default/profileSessionSettings/`                | Profile 別の session policy。認証・セッション設定として高感度。                                     |
| `force-app/main/default/profiles/`                              | 権限設計が詳細に出る。標準 Profile のノイズも多く、Permission Set / Permission Set Group に寄せる。 |
| `force-app/main/default/roles/`                                 | Community / Experience Cloud ユーザー由来のロールや会社名が混ざり得る。                             |
| `force-app/main/default/samlssoconfigs/`                        | SAML SSO、IdP、証明書、org 固有 URL を含む認証構成。                                                |
| `force-app/main/default/settings/Case.settings-meta.xml`        | default Case owner / user のメールアドレスや Case 通知設定を含み得る。                              |
| `force-app/main/default/settings/Forecasting.settings-meta.xml` | Forecasting の org 固有 ID 参照を含み得る。                                                         |
| `force-app/main/default/settings/MyDomain.settings-meta.xml`    | org 固有の My Domain 名と認証入口設定を含む。                                                       |

次の metadata は過去に ignore 対象を精査し、秘匿性が低く Git 管理対象として扱う判断にしたものです。

| metadata                       | 判断                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `appMenus/`                    | App Launcher / Mobile menu の org 状態。メールアドレスや secret を含まない。                          |
| `homePageLayouts/`             | Classic Home の標準コンポーネント配置。高秘匿情報を含まない。                                         |
| `iframeWhiteListUrlSettings/`  | iframe 許可 URL 設定。現物は空で、URL は secret ではない。                                            |
| `notificationTypeConfig/`      | 通知タイプごとの desktop / mobile 有効状態。個人情報や secret を含まない。                            |
| `remoteSiteSettings/`          | 外部接続先 URL。環境依存ではあるが secret ではなく、Developer Org の再現対象として扱う。              |
| `topicsForObjects/`            | オブジェクトごとの Topics 有効状態。実データの topic 名や投稿内容は含まない。                         |
| `transactionSecurityPolicies/` | Transaction Security policy。現物は inactive の標準 Report Export 保護 policy で、secret を含まない。 |

### LWC / test outputs

| パターン        | 理由                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `jsconfig.json` | LWC VS Code autocomplete のローカル生成物として扱う。                |
| `coverage/`     | `npm run test:unit:coverage` で生成される LWC Jest coverage report。 |

### Logs

| パターン                                                        | 理由                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------- |
| `logs/**`                                                       | `logs/` 配下の生成ログや解析結果を Git 管理しない。            |
| `!logs/**/`                                                     | Markdown 例外を判定できるよう、ディレクトリだけ再許可する。    |
| `!logs/**/*.md`                                                 | `logs/` 配下の guide や補足文書だけ Git 管理できるようにする。 |
| `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*` | Node / package manager / 一般ログの生成物を除外する。          |

### Local generated exports

| パターン                          | 理由                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `export-out/*`                    | Salesforce CLI の export 結果。CSV / JSON などの再生成可能な出力は Git 管理しない。 |
| `!export-out/export-out-guide.md` | 出力先フォルダの目的を示す guide だけ Git 管理する。                                |

### Dependency directories

| パターン        | 理由                                            |
| --------------- | ----------------------------------------------- |
| `node_modules/` | `package-lock.json` で再現する npm 依存の実体。 |

### Agent skills installed locally

| パターン           | 理由                                         |
| ------------------ | -------------------------------------------- |
| `.agents/`         | `sf-skills` / agent skill のローカル生成物。 |
| `skills-lock.json` | skill 導入時のローカル生成物。               |

### Tool caches

| パターン       | 理由                                                              |
| -------------- | ----------------------------------------------------------------- |
| `.pmdCache`    | ApexPMD / Salesforce Code Analyzer 系のローカルキャッシュ。       |
| `.eslintcache` | `eslint --cache` やエディタ連携で生成され得るローカルキャッシュ。 |

### OS system files

| パターン                                                      | 理由                                             |
| ------------------------------------------------------------- | ------------------------------------------------ |
| `.DS_Store`                                                   | macOS Finder のローカル表示設定。                |
| `Thumbs.db`, `ehthumbs.db`, `[Dd]esktop.ini`, `$RECYCLE.BIN/` | Windows のサムネイル、表示設定、ごみ箱フォルダ。 |

### Python Salesforce Functions

| パターン                | 理由                         |
| ----------------------- | ---------------------------- |
| `**/__pycache__/`       | Python bytecode cache。      |
| `**/.venv/`, `**/venv/` | Python virtual environment。 |
