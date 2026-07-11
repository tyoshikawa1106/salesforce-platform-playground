# DreamHouse 設定差分の扱い

Salesforce 公式サンプル `trailheadapps/dreamhouse-lwc` の設定ファイルとこのリポジトリの設定ファイルを比較しました。

この文書には、DreamHouse との差分を見つけたときの判断過程を追記します。
この文書は、当時の判断過程を残すためのディスカッションです。後続の導入状況は、当時の判断を消さずに「その後の更新」として追記します。

## 全体方針

DreamHouse の設定は Salesforce 公式サンプルとして参考にします。ただし、このリポジトリは CLI とメタデータで Salesforce 組織との差分を管理できる状態を目指すため、サンプルアプリやパッケージ公開向けの設定は採用対象を分けて判断します。

差分を取り込むかどうかは、次の観点で判断します。

- このリポジトリの再現性や品質確認に役立つか。
- CLI / metadata による差分管理を隠さないか。
- サンプルアプリ固有の packaging、公開、運用 automation に依存していないか。
- 将来の管理対象を広く除外しすぎないか。

## テーマ別ページ

| テーマ                                                                       | 内容                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------ |
| [source・解析設定](dreamhouse-configuration-diff/source-and-analysis.md)     | `.forceignore`、Code Analyzer、`.prettierignore` |
| [CI・テスト設定](dreamhouse-configuration-diff/ci-and-testing.md)            | Prettier、LWC Jest、アクセシビリティ、Codecov    |
| [リポジトリ周辺設定](dreamhouse-configuration-diff/repository-operations.md) | packaging、依存、VS Code、GitHub設定             |

## まとめ

今回の「設定・環境ファイル」観点では、DreamHouse との差分を一通り確認しました。

### 確認済み範囲

確認済みの範囲は次の通りです。

- `.forceignore`
- `code-analyzer.yml`
- CI の `prettier:verify`
- `jest-sa11y-setup.js` / `@sa11y/jest`
- `codecov.yml`
- packaging workflow / `packageAliases`
- `CODEOWNERS` / `SUPPORT.md` / auto-assign
- `.prettierignore` の `sfdx-project.json`
- 依存バージョン
- `.vscode/extensions.json`
- Issue / PR template
- Dependabot
- release 設定

### 採用判断

DreamHouse の良いところは、必要なものだけ採用判断できています。

- Code Analyzer: 採用候補として Issue 化済み。
- CI の Prettier check: 採用候補として Issue 化済み。
- LWC Jest + accessibility: 採用候補として Issue 化済み。
- GitHub Release notes 設定: ナレッジ化済み。
- 不要な設定: 理由付きでこの discussion に記録済み。

### 導入済み

その後、次の項目は導入済みになりました。

- Code Analyzer 設定: PR #72。
- CI の Prettier check: PR #73。
- LWC Jest + accessibility: PR #74。
- `sa11y` の提供元と用途の補足: PR #76。

### 採用しない判断

一方で、DreamHouse に合わせないと判断したものも明確です。

- `.forceignore` の広い metadata / TypeScript 除外
- `codecov.yml`
- packaging workflow / `packageAliases`
- `CODEOWNERS` / `SUPPORT.md` / auto-assign workflow
- `.prettierignore` の `sfdx-project.json` 除外
- DreamHouse の依存バージョンへの手動追従
- DreamHouse の `.vscode/extensions.json`
- DreamHouse の Issue / PR template
- DreamHouse の Dependabot 設定
- DreamHouse 由来の release 設定

これらは、このリポジトリの CLI / metadata 差分管理、軽量な GitHub Flow、既存の Dependabot / release notes / VS Code 推奨設定と合わないため、取り込みません。

残っている比較対象は `force-app` 配下の開発コード差分です。今後 DreamHouse 側を再確認する場合も、開発コードと設定・環境ファイルは分けて判断します。
