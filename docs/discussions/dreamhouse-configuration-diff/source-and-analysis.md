# DreamHouse: source・解析設定

[DreamHouse 設定差分の扱い](../dreamhouse-configuration-diff-policy.md)に戻る。

## `.forceignore`

### 結論

DreamHouse にある追加除外は、この判断では取り込みません。

このリポジトリでは、最終的に Salesforce CLI とメタデータで Salesforce 組織との差分を管理できる状態を目指します。そのため、組織由来のメタデータを `.forceignore` で先に隠すより、差分として見える状態を優先します。

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

`tsconfig.json` と `*.ts` は、Salesforce メタデータとして送る対象ではありません。ただし、将来 LWC や開発ツールで TypeScript を使う可能性があるため、広く除外する判断は保留します。

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

LWC を開発する場合、通常の `npm run lint` は `eslint.config.js` を直接使います。一方で `sf code-analyzer run` でも ESLint engine を使うため、Code Analyzer 側でもこのリポジトリの ESLint 設定を使えるようにする価値があります。

`auto_discover_eslint_config: true` は、Code Analyzer が `eslint.config.js` を自動検出するための設定です。

`disable_lwc_base_config: true` は、Code Analyzer 側の LWC base config と、このリポジトリの `eslint.config.js` の重複適用を避けるための設定です。

### 採用時の方針

採用する場合は、DreamHouse と同じファイル構成に合わせるのではなく、このリポジトリの方針として次を明記します。

- LWC / Aura の ESLint ルールは `eslint.config.js` を使う。
- Code Analyzer は repo の ESLint 設定を自動検出する。
- Code Analyzer 側の LWC base config は重複を避けるため無効化する。
- CI に `sf code-analyzer run --target force-app` を入れるかどうかは、設定ファイル追加とは別に判断する。

### その後の更新

PR #72 で `code-analyzer.yml` を追加済みです。
CI への `sf code-analyzer run` 追加は、引き続き別判断として扱います。

## `.prettierignore` の `sfdx-project.json`

### 結論

DreamHouse の `.prettierignore` にある `sfdx-project.json` 除外は、この判断では取り込みません。

このリポジトリでは、`sfdx-project.json` を Prettier の対象に残します。

### 判断理由

DreamHouse では、`sfdx-project.json` が CI workflow によって編集されるため、Prettier の対象から外しています。

このリポジトリでは、CI や packaging workflow が `sfdx-project.json` を編集する運用はありません。

また、`sfdx-project.json` は手で編集する通常の JSON 設定ファイルです。Prettier で整形して困りにくく、`prettier:verify` の対象に残す方が他の JSON 設定と扱いを揃えられます。

### 再検討条件

次のような段階になったら、`.prettierignore` に追加するか再検討します。

- CI や packaging script が `sfdx-project.json` を自動更新する。
- 2GP package の version や alias を workflow で更新する。
- `sfdx-project.json` を機械更新される設定ファイルとして扱う。

それまでは、DreamHouse に揃えて除外するより、Prettier 対象に残すシンプルな運用を優先します。
