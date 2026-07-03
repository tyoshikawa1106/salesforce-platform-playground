# npm audit 確認記録

この文書は、npm audit の見方と、このリポジトリでの扱いをまとめます。監査履歴ではなく、確認観点と判断基準を残します。

## 実行コマンド

```sh
npm audit --omit=dev
npm audit --audit-level=high
npm audit fix --dry-run --json
npm explain @salesforce/sfdx-lwc-jest
npm explain @salesforce/eslint-config-lwc
```

`npm audit fix` は、依存更新範囲が広がりやすいため自動では実行しません。

## 確認観点

- production dependency に high / critical がないか。
- devDependency の指摘が、LWC Jest / ESLint / Babel など開発ツールに閉じているか。
- `npm audit fix --dry-run --json` が、意図しない major downgrade や広い依存更新を提案していないか。
- Salesforce / LWC 関連パッケージの peer dependency と Node.js 前提が崩れないか。

## 判断

high / critical がなく、検出対象が開発用ツールチェーンに閉じている場合は、通常の feature / docs 変更に混ぜて `npm audit fix` を実行しません。

対応が必要な場合は、別 Issue / PR で最小変更として扱います。

候補:

- `@salesforce/sfdx-lwc-jest` の更新を単独で試す。
- `package-lock.json` の差分を確認し、不要に広い依存更新を避ける。
- LWC が追加された時点で `npm run test:unit` を通す。
- ESLint 設定を更新する場合は、`npm run lint` と設定互換性を確認する。
- high / critical が出た場合は、影響範囲を再確認して優先対応する。
