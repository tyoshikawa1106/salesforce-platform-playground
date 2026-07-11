# package.json

`package.json` は、このリポジトリの Node.js 実行環境、npm scripts、品質チェック用 devDependencies、pre-commit 対象を定義します。

依存追加や version 更新は `package-lock.json` に影響するため、明示確認してから実行します。

## 基本情報

| key           | 内容                               |
| ------------- | ---------------------------------- |
| `name`        | npm package 名。公開用途ではない。 |
| `private`     | `true`。npm publish しない。       |
| `version`     | ローカル package version。         |
| `description` | プロジェクト説明。                 |

## Node.js version

```json
"engines": {
    "node": ">=24 <25"
}
```

このリポジトリは Node.js 24 系を前提にします。`.node-version`、CI、setup docs と合わせて確認します。

## scripts

### Lint

```json
"lint": "eslint \"**/{aura,lwc}/**/*.js\" --no-error-on-unmatched-pattern"
```

Aura / LWC の JavaScript を ESLint で確認します。対象ファイルがない場合も失敗しないように `--no-error-on-unmatched-pattern` を付けています。

### LWC Jest

```json
"test": "npm run test:unit",
"test:unit": "sfdx-lwc-jest",
"test:unit:watch": "sfdx-lwc-jest --watch",
"test:unit:debug": "sfdx-lwc-jest --debug",
"test:unit:coverage": "sfdx-lwc-jest --coverage"
```

LWC unit test 用です。`test` は `test:unit` への alias です。

### Salesforce Code Analyzer

```json
"code-analyzer": "sf code-analyzer run --rule-selector Recommended --target force-app --output-file logs/code-analyzer/local.json",
"code-analyzer:ci": "sf code-analyzer run --rule-selector Recommended --target force-app --severity-threshold 3 --output-file logs/code-analyzer/ci.json"
```

`force-app` を対象に Salesforce Code Analyzer を実行します。結果は `logs/code-analyzer/` 配下に出力し、生成物は Git 管理しません。

`code-analyzer:ci` は severity threshold 付きで CI 相当の確認に使います。

### Docs

```json
"docs:check": "node scripts/docs/check-docs.js"
```

docs のローカルリンク、アンカー、見出し階層、ファイル名、`docs/index.md` からの到達性を確認します。

### Bulk results

```json
"data:bulk:results": "cd logs/data-bulk-results && sf data bulk results"
```

`sf data bulk results` の結果 CSV を `logs/data-bulk-results/` に出すための npm script です。

`sf data bulk results` には出力先 directory flag がないため、npm script 内で `logs/data-bulk-results/` に移動して実行します。`cd` は npm の子プロセス内だけで有効なため、実行後に作業ディレクトリを戻す必要はありません。

実行例:

```sh
npm run data:bulk:results -- --job-id <job-id> --target-org <alias>
```

### テストデータ setup

```json
"setup:data:standard": "node scripts/setup/import-test-data.js",
"setup:data:standard:dry-run": "node scripts/setup/import-test-data.js --dry-run"
```

標準テストデータ投入用の runner です。実投入では `--target-org <alias>` を指定します。

```sh
npm run setup:data:standard:dry-run
npm run setup:data:standard -- --target-org <alias>
```

### Salesforce 組織初回デプロイ / 再構築

```json
"sf:validate:dev": "sf project deploy validate --manifest manifest/rebuild-developer-org.xml --test-level RunLocalTests",
"sf:deploy:dev": "sf project deploy start --manifest manifest/rebuild-developer-org.xml"
```

Salesforce 組織への初回デプロイ / 再構築用 manifest を使う validate / deploy entrypoint です。実行前に対象 org を確認します。
変更範囲を狭く確認したい場合は、作業対象 manifest、対象 metadata type を絞った manifest、または `--metadata` で scope を絞ります。

### Prettier

```json
"prettier": "prettier --write \"**/*.{cls,cmp,component,css,html,js,json,md,page,trigger,xml,yaml,yml}\"",
"prettier:verify": "prettier --check \"**/*.{cls,cmp,component,css,html,js,json,md,page,trigger,xml,yaml,yml}\""
```

Apex、metadata、LWC、docs などを Prettier 対象にします。

- `prettier`: 対象ファイルを書き換える。
- `prettier:verify`: 整形確認だけ行う。

### pre-commit

```json
"prepare": "husky || true",
"precommit": "lint-staged"
```

`prepare` は npm install / npm ci 後に Husky を準備します。`precommit` は Husky pre-commit hook から呼ばれ、staged files だけに `lint-staged` を実行します。

## devDependencies

### Salesforce / LWC

| package                               | 用途                           |
| ------------------------------------- | ------------------------------ |
| `@salesforce/sfdx-lwc-jest`           | LWC unit test runner。         |
| `@salesforce/eslint-config-lwc`       | LWC 向け ESLint config。       |
| `@salesforce/eslint-plugin-aura`      | Aura 向け ESLint plugin。      |
| `@salesforce/eslint-plugin-lightning` | Lightning 向け ESLint plugin。 |
| `@lwc/eslint-plugin-lwc`              | LWC 固有 rule。                |

### Testing / accessibility

| package              | 用途                                    |
| -------------------- | --------------------------------------- |
| `@sa11y/jest`        | LWC Jest で `toBeAccessible()` を使う。 |
| `eslint-plugin-jest` | Jest test file 向け ESLint rule。       |

### Formatting / lint

| package                | 用途                                |
| ---------------------- | ----------------------------------- |
| `prettier`             | 共通 formatter。                    |
| `prettier-plugin-apex` | Apex formatter。                    |
| `@prettier/plugin-xml` | Salesforce metadata XML formatter。 |
| `eslint`               | JavaScript lint。                   |
| `eslint-plugin-import` | import 文関連の ESLint rule。       |

### Git hooks

| package       | 用途                                                 |
| ------------- | ---------------------------------------------------- |
| `husky`       | Git hook 実行。                                      |
| `lint-staged` | staged files にだけ formatter / lint / test を実行。 |

## overrides

```json
"overrides": {
    "@babel/core": "^7.29.7",
    "js-yaml": "^4.2.0"
}
```

依存ツリー内の package version を npm 側で上書きします。脆弱性対応や互換性維持のために使います。

変更する場合は、`package-lock.json` の差分とテスト影響を確認します。

## lint-staged

```json
"**/*.{cls,cmp,component,css,html,js,json,md,page,trigger,xml,yaml,yml}": [
    "prettier --write"
],
"**/{aura,lwc}/**/*.js": [
    "eslint"
],
"**/lwc/**": [
    "sfdx-lwc-jest -- --bail --findRelatedTests --passWithNoTests"
]
```

commit 時に staged files だけを対象にします。

| 対象                             | 実行内容                                       |
| -------------------------------- | ---------------------------------------------- |
| Apex / metadata / docs / JS など | Prettier で自動整形。                          |
| Aura / LWC JS                    | ESLint。                                       |
| LWC 配下                         | 関連 LWC Jest を `--findRelatedTests` で実行。 |

pre-commit で Prettier が staged files を書き換える可能性があります。commit 後は `git show` や `git diff HEAD^ HEAD` で実際の差分を確認します。

## 変更時の確認

| 変更内容                   | 確認コマンド例                                                |
| -------------------------- | ------------------------------------------------------------- |
| scripts / docs だけ        | `npm run prettier:verify`、`npm run docs:check`               |
| ESLint 設定や LWC JS       | `npm run lint -- --no-error-on-unmatched-pattern`             |
| LWC test 関連              | `npm run test:unit -- -- --runInBand --passWithNoTests`       |
| Code Analyzer 関連         | `npm run code-analyzer:ci`                                    |
| dependency / override 変更 | `npm install` 後に `package-lock.json` 差分と関連テストを確認 |

依存追加や lockfile 更新が必要な変更は、事前に明示確認してから実行します。
