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

## code-analyzer.yml

Salesforce Code Analyzer の engine 設定です。

```yaml
engines:
    eslint:
        auto_discover_eslint_config: true
        disable_lwc_base_config: true
```

repo の `eslint.config.js` を Code Analyzer 側で自動検出し、Code Analyzer 側の LWC base config との重複適用を避けます。

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
