# npm audit 確認メモ

Issue #2 で、初回セットアップ時に表示された npm audit 警告を確認しました。

## 確認日

- 2026-06-17
- 2026-06-20: 再確認。`npm audit --json` と `npm audit --omit=dev --json` はどちらも vulnerability 0 件。

## 実行コマンド

```sh
npm audit --json
npm audit --omit=dev --json
npm audit --audit-level=high
npm audit fix --dry-run --json
npm explain @salesforce/sfdx-lwc-jest
npm explain @salesforce/eslint-config-lwc
npm explain @babel/core
npm explain js-yaml
```

`npm audit fix` は実行していません。

## 結果

### 2026-06-20 再確認

`npm audit --json` と `npm audit --omit=dev --json` は、どちらも vulnerability 0 件でした。
production dependency だけでなく、devDependency を含めても audit 指摘はありません。

### 2026-06-17 初回確認

`npm audit --json` の内訳は次の通りです。

| severity | 件数 |
| -------- | ---: |
| low      |    3 |
| moderate |   24 |
| high     |    0 |
| critical |    0 |
| total    |   27 |

直接依存として audit に出ているのは、次の devDependency です。

| 依存                            | 用途            | 状態                                     |
| ------------------------------- | --------------- | ---------------------------------------- |
| `@salesforce/sfdx-lwc-jest`     | LWC Jest        | moderate、修正候補なし                   |
| `@salesforce/eslint-config-lwc` | LWC ESLint 設定 | low、提示される修正は古い major への変更 |

主な検出元は、LWC/Jest/Babel 周辺の推移依存です。

| 検出元              | 経路                                                               | メモ                                                         |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `@babel/core`       | `@lwc/compiler`、`@salesforce/eslint-config-lwc`                   | low。`sourceMappingURL` コメント経由の任意ファイル読み取り。 |
| `js-yaml`           | `jest` -> `babel-plugin-istanbul` -> `@istanbuljs/load-nyc-config` | moderate。YAML merge key 処理の DoS。                        |
| Jest 関連パッケージ | `@salesforce/sfdx-lwc-jest` -> `@lwc/jest-preset` -> `jest`        | moderate。複数パッケージに伝播して 24 件の大半を占める。     |

現在のリポジトリでは production dependency は実質なく、検出対象は開発用ツールチェーンです。

`npm audit --omit=dev --json` では 0 件でした。`npm audit --audit-level=high` も終了コード 0 でした。

## 判断

現時点では、Issue #2 の範囲で `npm audit fix` は実行しません。

理由:

- high / critical がありません。
- 検出対象は LWC Jest / ESLint などの開発用依存です。
- `npm audit fix --dry-run --json` では `@salesforce/sfdx-lwc-jest` の更新により LWC、Vitest、Rollup など多数の追加・更新が発生します。
- `@salesforce/eslint-config-lwc` の audit fix 候補は `0.11.0` への major 変更で、現在の `4.1.2` からの安全な更新とは判断しません。
- このリポジトリは現時点で Apex / Salesforce metadata / docs 中心で、LWC 実装はまだありません。

## 今後の方針

対応が必要になった場合は、別 Issue / PR で最小変更として扱います。

候補:

- `@salesforce/sfdx-lwc-jest` の更新を単独で試す。
- `package-lock.json` の差分を確認し、不要に広い依存更新を避ける。
- LWC が追加された時点で `npm run test:unit` を通す。
- ESLint 設定を更新する場合は、`npm run lint` と設定互換性を確認する。
- high / critical が出た場合は、影響範囲を再確認して優先対応する。
