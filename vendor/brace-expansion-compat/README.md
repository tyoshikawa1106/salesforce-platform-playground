# brace-expansion 互換パッケージ

このローカルパッケージは、`brace-expansion 5.0.8` の展開数・合計文字数上限を、Jest、ESLint、SLDS Linter 配下の全依存経路へ適用します。

上位ツールには、CommonJSでモジュール自体を関数として呼び出す旧APIと、ES Modulesで `expand` を参照する現行APIが混在しています。
`index.cjs` と `index.mjs` は両方のAPIを提供し、`package.json` の `overrides` から同じ実装へ固定します。

実装は [brace-expansion 5.0.8](https://github.com/juliangruber/brace-expansion/tree/v5.0.8) の修正済みアルゴリズムを基準にしています。
ライセンスは同梱する `LICENSE` を参照してください。

## 確認

```sh
npm ci --include=dev
npm audit --audit-level=high
npm run test:scripts
npm run lint -- --no-error-on-unmatched-pattern
npm run lint:slds
npm run test:unit -- -- --runInBand --passWithNoTests
```

`npm audit` の監査対象や失敗条件は変更しません。

## 削除条件

Jest、ESLint、SLDS Linterの上位依存が安全版の `brace-expansion` と互換APIを採用し、`package.json` のoverrideを外しても上記確認がすべて成功した時点で、このパッケージを削除します。
