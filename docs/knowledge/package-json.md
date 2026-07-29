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
"lint": "eslint \"**/{aura,lwc}/**/*.js\" \"scripts/**/*.js\" --no-error-on-unmatched-pattern",
"lint:slds": "slds-linter lint force-app/main/default/lwc"
```

Aura／LWCと`scripts/**/*.js`のJavaScriptをESLintで確認します。対象ファイルがない場合も失敗しないように`--no-error-on-unmatched-pattern`を付けています。

`lint:slds`は`force-app/main/default/lwc`配下のHTMLとCSSをSLDS Linterで確認します。ローカルとCIは同じnpm scriptを使うため、`npm ci`後は外部からパッケージを取得せずに同じ条件を再現できます。検査内容と他の品質チェックとの役割分担は[SLDS Linter](slds-linter.md)を参照します。

### Test

```json
"test": "npm run test:scripts && npm run test:unit",
"test:scripts": "node --test scripts/scratch-org/test/*.node.js scripts/docs/test/*.node.js scripts/setup/test/*.node.js scripts/metadata/retrieve/test/*.node.js vendor/brace-expansion-compat/test/*.node.cjs",
"test:unit": "sfdx-lwc-jest",
"test:unit:watch": "sfdx-lwc-jest --watch",
"test:unit:debug": "sfdx-lwc-jest --debug",
"test:unit:coverage": "sfdx-lwc-jest --coverage"
```

`test:scripts`はScratch Org、文書検査、データ投入、retrieve plan、依存互換コードをNode.js test runnerで確認します。
`test:unit` は LWC unit test 用です。`test` は両方を順に実行します。

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

`docs:check`はGit管理対象と未追跡・非除外のMarkdownを自動検出し、ローカルリンク、アンカー、見出し階層を確認します。docsではファイル名と`docs/index.md`からの到達性も確認し、PRテンプレートなどの文書断片にはH1を要求しません。

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

### Salesforce destructive changes

```json
"sf:destructive": "bash scripts/metadata/destructive/destructive.sh"
```

destructive changesの実行入口です。default target orgを表示し、実行確認後にdry-runします。dry-run成功後の再確認で承認した場合だけ実削除します。

接続組織向けの全体validate / deployを実行するnpm scriptは管理しません。通常開発ではGit差分と明示した依存metadataだけを、`sf project deploy validate`または`sf project deploy start`へ明示します。

### Salesforce メタデータ一括取得

```json
"sf:retrieve": "bash scripts/metadata/retrieve/retrieve.sh"
```

VS Codeで現在接続している組織の`target-org`設定を使い、`scripts/metadata/retrieve/retrieve-plan.txt`に列挙した順でmetadataを取得します。`retrieve-profile.xml`を最初、`retrieve-translations.xml`を最後に置き、`Translations`と関連メタデータを同時に取得して翻訳ファイルの部分的な上書きを防ぎます。`package.xml`は手動retrieve用のため、このコマンドでは使用しません。

```sh
npm run sf:retrieve
```

実行時にdefault target orgを表示し、確認に`y`または`Y`を入力した場合だけ、planのmanifestを順番に取得します。進捗の総数はplanから計算します。それ以外の入力では取得を中止し、いずれかのretrieveが失敗した場合はその時点で処理を終了します。

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

`prepare`はnpm install / npm ci後にHuskyを準備します。`precommit`はHusky pre-commitフックから呼ばれ、ステージ済みファイルだけに`lint-staged`を実行します。

## devDependencies

### Salesforce / LWC

| package                               | 用途                            |
| ------------------------------------- | ------------------------------- |
| `@salesforce/sfdx-lwc-jest`           | LWC unit test runner。          |
| `@salesforce/eslint-config-lwc`       | LWC 向け ESLint config。        |
| `@salesforce/eslint-plugin-aura`      | Aura 向け ESLint plugin。       |
| `@salesforce/eslint-plugin-lightning` | Lightning 向け ESLint plugin。  |
| `@salesforce-ux/slds-linter`          | LWC の SLDS 準拠を検査するCLI。 |
| `@lwc/eslint-plugin-lwc`              | LWC 固有 rule。                 |

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
| `husky`       | Gitフック実行。                                      |
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
| `scripts/**/*.js`                | ESLint。                                       |
| LWC 配下                         | 関連 LWC Jest を `--findRelatedTests` で実行。 |

pre-commit で Prettier が staged files を書き換える可能性があります。commit 後は `git show` や `git diff HEAD^ HEAD` で実際の差分を確認します。

## 変更時の確認

| 変更内容                   | 確認コマンド例                                                    |
| -------------------------- | ----------------------------------------------------------------- |
| Markdown                   | `npm run prettier:verify`、`npm run docs:check`                   |
| scripts                    | `npm run prettier:verify`、`npm run lint`、`npm run test:scripts` |
| ESLint 設定や LWC JS       | `npm run lint -- --no-error-on-unmatched-pattern`                 |
| LWC の HTML / CSS          | `npm run lint:slds`                                               |
| LWCテスト関連              | `npm run test:unit -- -- --runInBand --passWithNoTests`           |
| Code Analyzer関連          | `npm run code-analyzer:ci`                                        |
| 依存関係 / override の変更 | `npm install` 後に `package-lock.json` 差分と関連テストを確認     |

依存追加や lockfile 更新が必要な変更は、事前に明示確認してから実行します。
