# DreamHouse: CI・テスト設定

[DreamHouse 設定差分の扱い](../dreamhouse-configuration-diff-policy.md)に戻る。

## CI の `prettier:verify`

### 結論

DreamHouse と同じく、CI で `npm run prettier:verify` を実行する構成は、このリポジトリでも採用候補にします。

ただし、この discussion では CI workflow を変更しません。別 Issue として、`.github/workflows/ci.yml` の `npm checks` に format check を追加するか検討します。

### 判断理由

このリポジトリにはすでに次の Prettier 運用があります。

- `package.json` に `prettier` と `prettier:verify` script がある。
- pre-commit hook では staged files に対して `prettier --write` を実行する。
- `docs/setup/project-setup.md` では `npm run prettier:verify` を整形確認用として扱っている。

一方で、当時の CI は `npm ci`、`npm audit --omit=dev`、lint、LWC unit test を実行していましたが、format check は実行していませんでした。

そのため、hook を通さない変更、GitHub 上での直接編集、将来の自動生成差分などで整形崩れが入った場合、CI では検出できません。

`prettier:verify` は Salesforce org 認証、Java、Python を必要とせず、既存 npm 依存だけで実行できます。Code Analyzer や deploy validation より軽く、PR 品質ゲートとして追加しやすい確認です。

### 採用時の方針

採用する場合は、CI の `npm checks` に次のステップを追加します。

```yaml
- name: Check formatting
  run: npm run prettier:verify
```

実行位置は lint より前にします。整形崩れは軽く早く検出できるため、lint や LWC unit test の前に落とす方が分かりやすいためです。

この変更は整形を自動修正しません。CI では `--check` で失敗させるだけにし、修正はローカルの `npm run prettier` または pre-commit hook に任せます。

### その後の更新

PR #73 で `.github/workflows/ci.yml` の `npm checks` に `npm run prettier:verify` を追加済みです。

## `jest-sa11y-setup.js` / `@sa11y/jest`

### 結論

DreamHouse の `jest-sa11y-setup.js` と `@sa11y/jest` は、LWC Jest のアクセシビリティ確認を本格運用する前提で採用候補にします。

ただし、この discussion では依存追加や Jest 設定変更は行いません。別 Issue として、LWC テスト基盤に `@sa11y/jest` を組み込むか検討します。

### 判断理由

このリポジトリには、すでに `@salesforce/sfdx-lwc-jest`、`test:unit` script、CI の LWC unit test 実行があります。一方で、この判断では LWC 実装と LWC Jest test はまだありません。

LWC を今後開発する前提では、Jest test はコンポーネントの表示やイベントだけでなく、最低限のアクセシビリティ確認にも使いたいです。

`@sa11y/jest` は Jest test で DOM のアクセシビリティを確認する matcher を提供します。LWC test で rendering 後の DOM に対して `toBeAccessible()` のような assertion を書けるようになります。

### 採用時の方針

採用する場合は、最初の LWC test 基盤整備の一部として扱います。

- `@sa11y/jest` を devDependency に追加する。
- Jest setup file を追加し、`@sa11y/jest` の API を project level で登録する。
- `jest.config.js` の `setupFilesAfterEnv` に setup file を追加する。
- 最初の LWC test で、rendering 後の DOM に対して accessibility assertion を書く例を用意する。
- `npm run test:unit -- -- --runInBand --passWithNoTests` で確認する。

この設定だけでは、すべての LWC が自動でアクセシビリティ検査されるわけではありません。各 test で対象 DOM を確認する assertion を書くか、automatic checks を明示的に有効化する必要があります。

automatic checks は便利ですが、test の失敗理由を上書きしたり、DOM cleanup の順序に影響を受けたりする可能性があります。そのため、最初は明示的な assertion から始めます。

### その後の更新

PR #74 で `@sa11y/jest`、`jest-sa11y-setup.js`、`jest.config.js` の setup file 登録を追加済みです。
PR #76 で、`sa11y` が Salesforce 社公開の OSS であり、Salesforce 組織接続やメタデータ操作のツールではないことを `docs/knowledge/lwc-jest-accessibility-testing.md` に追記しました。

## `codecov.yml`

### 結論

DreamHouse の `codecov.yml` は、この判断では取り込みません。

このリポジトリでは Codecov upload を使う CI を採用していないため、`codecov.yml` だけを追加しても効果がありません。

### 判断理由

Codecov は、CI で生成した coverage 結果を外部サービスへアップロードし、PR や branch ごとの coverage 変化を可視化するためのサービスです。

`codecov.yml` は、その Codecov 側での coverage status、flags、ignore などを調整する設定ファイルです。coverage を測定するファイルではなく、Codecov upload workflow とセットで意味を持ちます。

DreamHouse では LWC coverage と Apex coverage を Codecov に upload し、`codecov.yml` で `LWC` / `Apex` flags を分けています。

一方で、当時の CI は `npm ci`、`npm audit --omit=dev`、lint、LWC unit test を実行するだけでした。Codecov への upload はなく、Apex coverage も GitHub Actions 上では扱っていませんでした。

### 再検討条件

次のような段階になったら、`codecov.yml` を再検討します。

- CI で LWC Jest coverage を生成して保存または公開したい。
- CI で Apex test coverage を扱う運用を決めた。
- GitHub Actions artifact や job summary では足りず、外部サービスで coverage 推移を見たい。
- Codecov の repository 設定、token、private repository のプランや権限を確認できた。

それまでは、外部サービス連携を増やすより、ローカルと CI の軽い品質チェックを優先します。
