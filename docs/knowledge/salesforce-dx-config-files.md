# Salesforce DX 設定ファイル

このページは、Salesforce DX と Scratch Org 周辺の設定ファイルの内容を説明します。

## sfdx-project.json

Salesforce DX project の基本設定です。

| key                  | 内容                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `packageDirectories` | Salesforce source directory の一覧。                               |
| `path`               | metadata source の root。現在は `force-app`。                      |
| `default`            | default package directory。通常の deploy / retrieve の基準になる。 |
| `name`               | DX project 名。                                                    |
| `namespace`          | package namespace。空文字は namespace なし。                       |
| `sfdcLoginUrl`       | login 先。通常 org は `https://login.salesforce.com`。             |
| `sourceApiVersion`   | source convert / deploy / retrieve などで使う API version。        |

変更時は、API version、package directory、manifest、CI、docs への影響を確認します。

## config/project-scratch-def.json

Scratch Org 作成時の edition、features、作成時 settings を定義します。Salesforce 組織への deploy 先設定ではありません。

| key        | 内容                                                                |
| ---------- | ------------------------------------------------------------------- |
| `orgName`  | 作成される Scratch Org の表示名。                                   |
| `edition`  | Scratch Org の edition。                                            |
| `features` | 作成時に有効化する Scratch Org feature。                            |
| `settings` | 作成時に適用できる org settings。metadata deploy の全設定とは別物。 |

現在は `EnableSetPasswordInApi`、Lightning desktop、mobile encrypted storage pref を定義しています。

変更時は、Scratch Org 作成時にしか効かない feature と、metadata deploy で変更できる settings を混同しないようにします。

## scripts/deploy/scratch-org/scratch-org.json

Scratch Org 準備スクリプトの repo-local 設定です。

| key              | 内容                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `aliasPrefix`    | 作成する Scratch Org alias の接頭辞。実 alias は `scratch-org-YYYYMMDD` 形式で生成する。 |
| `definitionFile` | Scratch Org definition file。                                                            |
| `durationDays`   | Scratch Org の有効日数。                                                                 |
| `importPlan`     | テストデータ import plan。                                                               |
| `manifest`       | Scratch Org 初期反映に使う manifest。                                                    |
| `permissionSet`  | Scratch Org user に割り当てる permission set。                                           |
| `waitMinutes`    | CLI の作成 / deploy 待機時間。                                                           |

個人専用 alias、ユーザー名、秘密情報は固定しません。

## .forceignore

Salesforce CLI の deploy / retrieve / preview / source tracking で無視するファイルを定義します。Git 管理から外す `.gitignore` とは役割が違います。

| パターン            | 理由                                                  |
| ------------------- | ----------------------------------------------------- |
| `package.xml`       | 作業用 package.xml を metadata として扱わない。       |
| `**/jsconfig.json`  | LWC VS Code autocomplete 生成物を送らない。           |
| `**/.eslintrc.json` | LWC / Aura tool 設定を metadata として送らない。      |
| `**/__tests__`      | LWC Jest test を Salesforce metadata として送らない。 |
| `force-app/test/**` | Jest mocks など test support file を送らない。        |
| `node_modules/`     | npm 依存を送らない。                                  |

Git 管理対象外にしたい場合は `.gitignore`、整形対象外にしたい場合は `.prettierignore` を使います。
