# DreamHouse 設定差分の扱い

2026-06-20 時点で、Salesforce 公式サンプル `trailheadapps/dreamhouse-lwc` の設定ファイルとこのリポジトリの設定ファイルを比較しました。

このメモには、DreamHouse との差分を見つけたときの判断過程を追記します。

## 全体方針

DreamHouse の設定は Salesforce 公式サンプルとして参考にします。ただし、このリポジトリは CLI とメタデータで Dev 組織との差分を管理できる状態を目指すため、サンプルアプリやパッケージ公開向けの設定はそのまま取り込みません。

差分を取り込むかどうかは、次の観点で判断します。

- このリポジトリの再現性や品質確認に役立つか。
- CLI / metadata による差分管理を隠さないか。
- サンプルアプリ固有の packaging、公開、運用 automation に依存していないか。
- 将来の管理対象を広く除外しすぎないか。

## `.forceignore`

### 結論

DreamHouse にある追加除外は、現時点では取り込みません。

このリポジトリでは、最終的に Salesforce CLI とメタデータで Dev 組織との差分を管理できる状態を目指します。そのため、組織由来のメタデータを `.forceignore` で先に隠すより、差分として見える状態を優先します。

### 取り込まない除外

DreamHouse には次の除外がありますが、このリポジトリでは採用しません。

```text
**/appMenus/**
**/appSwitcher/**
**/objectTranslations/**
**/profiles/**
**/settings/**
**/tsconfig.json
**/*.ts
```

`appMenus` や `appSwitcher` は、アプリメニューや App Launcher 系の組織 UI 設定に近いメタデータです。現在の実装では直接必要ありませんが、除外すると将来 CLI で取得した差分を見落とす可能性があります。

`profiles`、`settings`、`objectTranslations` も同様に、最初から source operation の対象外にすると、管理対象にするべきかどうかの判断材料を失います。

`tsconfig.json` と `*.ts` は、現時点で Salesforce メタデータとして送る対象ではありません。ただし、将来 LWC や開発ツールで TypeScript を使う可能性があるため、広く除外する判断は保留します。

### 現在の方針

`.forceignore` は、Salesforce source operation に明確に不要な開発用ファイルだけを除外します。

現在の除外方針は次の範囲にとどめます。

```text
package.xml
**/jsconfig.json
**/.eslintrc.json
**/__tests__/**
node_modules/
```

今後、実際の retrieve / deploy / status の運用で特定のメタデータが恒常的なノイズになる場合は、除外する前に「このリポジトリで管理対象外にする」と明示的に判断します。

## `code-analyzer.yml`

### 結論

DreamHouse の `code-analyzer.yml` は、このリポジトリでも採用候補にします。

ただし、この discussion では設定ファイルを追加しません。LWC 開発を進める前提で、別 Issue としてこのリポジトリ向けの Code Analyzer 設定を用意するか検討します。

### 判断理由

DreamHouse の `code-analyzer.yml` は、Code Analyzer の ESLint engine について次の設定を持ちます。

```yaml
engines:
    eslint:
        auto_discover_eslint_config: true
        disable_lwc_base_config: true
```

LWC を開発する場合、通常の `npm run lint` は `eslint.config.js` を直接使います。一方で `sf code-analyzer run` でも ESLint engine を使うため、Code Analyzer 側でもこのリポジトリの ESLint 設定を正として使えるようにする価値があります。

`auto_discover_eslint_config: true` は、Code Analyzer が `eslint.config.js` を自動検出するための設定です。

`disable_lwc_base_config: true` は、Code Analyzer 側の LWC base config と、このリポジトリの `eslint.config.js` の重複適用を避けるための設定です。

### 採用時の方針

採用する場合は、DreamHouse と同じファイルを単にコピーするのではなく、このリポジトリの方針として次を明記します。

- LWC / Aura の ESLint ルールは `eslint.config.js` を正とする。
- Code Analyzer は repo の ESLint 設定を自動検出する。
- Code Analyzer 側の LWC base config は重複を避けるため無効化する。
- CI に `sf code-analyzer run --target force-app` を入れるかどうかは、設定ファイル追加とは別に判断する。

## CI の `prettier:verify`

### 結論

DreamHouse と同じく、CI で `npm run prettier:verify` を実行する構成は、このリポジトリでも採用候補にします。

ただし、この discussion では CI workflow を変更しません。別 Issue として、`.github/workflows/ci.yml` の `npm checks` に format check を追加するか検討します。

### 判断理由

このリポジトリにはすでに次の Prettier 運用があります。

- `package.json` に `prettier` と `prettier:verify` script がある。
- pre-commit hook では staged files に対して `prettier --write` を実行する。
- `docs/setup/local-development.md` では `npm run prettier:verify` を整形確認用として扱っている。

一方で、現在の CI は `npm ci`、`npm audit --omit=dev`、lint、LWC unit test を実行しますが、format check は実行していません。

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
