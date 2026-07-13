# 品質チェック設定ファイル

このページは、formatter、lint、test、Code Analyzer、pre-commit に関係する設定ファイルの内容を説明します。

## eslint.config.js

ESLint flat config です。対象ごとに設定を分けます。

| 対象                    | 設定内容                                              |
| ----------------------- | ----------------------------------------------------- |
| `**/aura/**/*.js`       | Aura recommended + Locker rule。                      |
| `**/lwc/**/*.js`        | Salesforce LWC recommended config。                   |
| `**/lwc/**/*.test.js`   | LWC config に test 用 override を追加。               |
| `**/jest-mocks/**/*.js` | Jest mocks 用に Node / ES2021 / Jest globals を設定。 |

LWC test では wire adapter mock の扱いが runtime 実装と異なるため、test file だけ `@lwc/lwc/no-unexpected-wire-adapter-usages` を無効化しています。

確認:

```sh
npm run lint -- --no-error-on-unmatched-pattern
```

## jest.config.js

`@salesforce/sfdx-lwc-jest` の標準 config を拡張します。

| key                        | 内容                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `moduleNameMapper`         | Lightning wire adapter などの local mock を割り当てる。              |
| `collectCoverageFrom`      | coverage 対象の LWC JS と除外対象を定義する。                        |
| `coverageProvider`         | `v8` を使う。                                                        |
| `modulePathIgnorePatterns` | `.localdevserver` を test 探索から除外する。                         |
| `setupFilesAfterEnv`       | `jest-sa11y-setup.js` を読み込み、accessibility matcher を登録する。 |

確認:

```sh
npm run test:unit -- -- --runInBand --passWithNoTests
```

## jest-sa11y-setup.js

LWC Jest で `@sa11y/jest` の matcher を登録します。`toBeAccessible()` を test で使えるようにするための setup file です。

```js
const { setup } = require('@sa11y/jest');

setup();
```

## code-analyzer.yml / config/code-analyzer/pmd-ruleset.xml

Salesforce Code Analyzer のengine設定と、リポジトリ専用のPMDルールを管理します。

| ファイル                               | 役割                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `code-analyzer.yml`                    | ESLint / PMD engine、標準ルールと代替ルールのtag、カスタムルールのseverityを設定する。      |
| `config/code-analyzer/pmd-ruleset.xml` | リポジトリ規約に合わせた`ApexDocWithoutProperties`と`TriggerDelegatesToHandler`を定義する。 |

ESLint engineではrepoの`eslint.config.js`を自動検出し、Code Analyzer側のLWC / React base configとの重複適用を避けます。PMD engineは`config/code-analyzer/pmd-ruleset.xml`をカスタムrulesetとして読み込みます。

標準PMDルールを単に抑止するのではなく、リポジトリ規約と衝突する標準ルールから`Recommended` tagを外し、次の代替ルールへ付け替えます。

| 標準ルール            | 代替ルール                  | 検査内容                                                                                    |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| `ApexDoc`             | `ApexDocWithoutProperties`  | プロパティの`//`コメントを許容し、クラス、コンストラクタ、公開メソッドのApexDocを検査する。 |
| `AvoidLogicInTrigger` | `TriggerDelegatesToHandler` | Trigger context分岐とhandler呼び出しを許容し、SOQL、DML、代入、ループ、業務処理を拒否する。 |

確認:

```sh
npm run code-analyzer:ci
```

## .prettierrc

Prettier の整形ルールです。

| key             | 内容                                                 |
| --------------- | ---------------------------------------------------- |
| `trailingComma` | 末尾 comma を付けない。                              |
| `singleQuote`   | JavaScript などで single quote を使う。              |
| `tabWidth`      | 4 spaces。Apex / LWC / Aura の repo 方針に合わせる。 |
| `printWidth`    | 120。                                                |
| `plugins`       | Apex と XML の formatter plugin。                    |

LWC HTML は `lwc` parser、Aura / Visualforce 系は `html` parser を使います。

## .prettierignore

Prettier 対象外を定義します。

| パターン                             | 理由                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| `**/staticresources/**`              | static resource の中身を勝手に整形しない。                |
| `.localdevserver`, `.sfdx`, `.sf`    | local tool / Salesforce cache。                           |
| `.agents`                            | local agent skill cache。                                 |
| `coverage/`                          | LWC Jest coverage。                                       |
| `export-out/*`                       | Salesforce CLI export 生成物。                            |
| `logs/**`                            | ローカルログ / 解析結果。                                 |
| `!logs/**/*.md`                      | guide だけ整形対象に戻す。                                |
| `force-app/main/default/classes/**`  | retrieve 済み Apex class の整形差分を不用意に広げない。   |
| `force-app/main/default/triggers/**` | retrieve 済み Apex trigger の整形差分を不用意に広げない。 |
| `force-app/main/default/lwc/**`      | retrieve 済み LWC の整形差分を不用意に広げない。          |
| `force-app/main/default/**/*.xml`    | retrieve 済み metadata XML の整形差分を不用意に広げない。 |

確認:

```sh
npm run prettier:verify
```

## .husky/pre-commit

commit 前に `package.json` の `precommit` script を実行します。

```sh
npm run precommit
```

現在は `lint-staged` を呼び、staged files だけに Prettier、ESLint、関連 LWC Jest を実行します。
