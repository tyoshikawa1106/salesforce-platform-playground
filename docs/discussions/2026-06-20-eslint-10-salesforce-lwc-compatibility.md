# ESLint 10 と Salesforce / LWC ESLint パッケージの互換性

2026-06-20 時点で、Dependabot PR #50 の `eslint` 10.5.0 更新を確認しました。

## 結論

現時点では、このリポジトリで `eslint` 10 系へ更新しません。

理由は、現在利用している Salesforce / LWC ESLint 関連パッケージの latest が、まだ `eslint` 10 を peer dependency として許可していないためです。

CI でも `npm ci --include=dev` の段階で `ERESOLVE` になり、lint 実行前に依存関係のインストールが失敗しました。

## 確認した package metadata

公開 npm registry の latest metadata を確認しました。
2026-06-20 に再確認し、Salesforce / LWC ESLint 関連パッケージの ESLint peer dependency は引き続き `^9` でした。

| package                               | latest  | ESLint peer dependency |
| ------------------------------------- | ------- | ---------------------- |
| `@salesforce/eslint-config-lwc`       | `4.1.2` | `^9`                   |
| `@lwc/eslint-plugin-lwc`              | `3.5.0` | `^9`                   |
| `@salesforce/eslint-plugin-aura`      | `3.0.0` | `^9`                   |
| `@salesforce/eslint-plugin-lightning` | `2.0.0` | `^9`                   |
| `@babel/eslint-parser`                | `8.0.1` | `^9.0.0 \|\| ^10.0.0`  |

`@babel/eslint-parser` 自体は 8 系で `eslint` 10 対応済みです。

ただし `@salesforce/eslint-config-lwc` の latest は `@babel/eslint-parser` `~7.25.9` に依存しており、Salesforce / LWC ESLint スタック全体としては `eslint` 10 対応が揃っていません。

## PR #50 の失敗内容

PR #50 は `eslint` を `9.39.4` から `10.5.0` へ更新する Dependabot PR でした。

GitHub Actions の `npm checks` は `Install dependencies` で失敗しました。

主なエラーは次の依存解決エラーです。

```text
Found: eslint@10.5.0
Could not resolve dependency:
peer eslint@"^7.5.0 || ^8.0.0 || ^9.0.0" from @babel/eslint-parser@7.29.7
```

これは実行時の lint warning ではなく、npm の peer dependency 解決が成立しない状態です。

## 判断

この更新は、`--legacy-peer-deps` や `--force` で通しません。

それらのオプションは、互換性が宣言されていない依存関係の組み合わせを許容するため、CI の再現性と ESLint 設定の信頼性を下げます。

`eslint` 10 系への更新は、Salesforce / LWC ESLint 関連パッケージが `eslint` 10 を peer dependency として許可してから、関連パッケージをまとめて確認します。

## 再確認条件

次のいずれかが起きたら再確認します。

- `@salesforce/eslint-config-lwc` が `eslint` 10 を peer dependency として許可する。
- `@lwc/eslint-plugin-lwc` が `eslint` 10 を peer dependency として許可する。
- `@salesforce/eslint-plugin-aura` と `@salesforce/eslint-plugin-lightning` が `eslint` 10 を peer dependency として許可する。
- Dependabot が `eslint` 10 を含む更新 PR を再作成した。

再確認時は `npm ci --include=dev`、`npm run lint -- --no-error-on-unmatched-pattern`、`npm run test:unit -- -- --runInBand --passWithNoTests` を通してから判断します。
