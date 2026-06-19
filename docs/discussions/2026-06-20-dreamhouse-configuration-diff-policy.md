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
