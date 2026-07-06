# DreamHouse 設定差分の扱い

Salesforce 公式サンプル `trailheadapps/dreamhouse-lwc` の設定ファイルとこのリポジトリの設定ファイルを比較しました。

この文書には、DreamHouse との差分を見つけたときの判断過程を追記します。
この文書は、当時の判断過程を残すためのディスカッションです。後続の導入状況は、当時の判断を消さずに「その後の更新」として追記します。

## 全体方針

DreamHouse の設定は Salesforce 公式サンプルとして参考にします。ただし、このリポジトリは CLI とメタデータで Salesforce 組織との差分を管理できる状態を目指すため、サンプルアプリやパッケージ公開向けの設定はそのまま取り込みません。

差分を取り込むかどうかは、次の観点で判断します。

- このリポジトリの再現性や品質確認に役立つか。
- CLI / metadata による差分管理を隠さないか。
- サンプルアプリ固有の packaging、公開、運用 automation に依存していないか。
- 将来の管理対象を広く除外しすぎないか。

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

採用する場合は、DreamHouse と同じファイルをそのまま取り込むのではなく、このリポジトリの方針として次を明記します。

- LWC / Aura の ESLint ルールは `eslint.config.js` を使う。
- Code Analyzer は repo の ESLint 設定を自動検出する。
- Code Analyzer 側の LWC base config は重複を避けるため無効化する。
- CI に `sf code-analyzer run --target force-app` を入れるかどうかは、設定ファイル追加とは別に判断する。

### その後の更新

PR #72 で `code-analyzer.yml` を追加済みです。
CI への `sf code-analyzer run` 追加は、引き続き別判断として扱います。

## CI の `prettier:verify`

### 結論

DreamHouse と同じく、CI で `npm run prettier:verify` を実行する構成は、このリポジトリでも採用候補にします。

ただし、この discussion では CI workflow を変更しません。別 Issue として、`.github/workflows/ci.yml` の `npm checks` に format check を追加するか検討します。

### 判断理由

このリポジトリにはすでに次の Prettier 運用があります。

- `package.json` に `prettier` と `prettier:verify` script がある。
- pre-commit hook では staged files に対して `prettier --write` を実行する。
- `docs/setup/project.md` では `npm run prettier:verify` を整形確認用として扱っている。

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

## packaging workflow / `packageAliases` / `CODEOWNERS` / `SUPPORT.md` / auto-assign

### 結論

DreamHouse の packaging workflow、`packageAliases`、`CODEOWNERS`、`SUPPORT.md`、auto-assign workflow は、この判断では取り込みません。

これらは、公開サンプルアプリ、パッケージ配布、外部利用者向け support、メンテナチーム運用に寄った設定です。このリポジトリの現在の目的とは前提が違います。

### 判断理由

DreamHouse の packaging workflow は、サンプルアプリを package 化し、package version を作成・検証・配布する運用を前提にしています。

このリポジトリでは、2GP package を作成・配布する方針はありません。`force-app` を基準にして、Salesforce 組織へ deploy / validate できる状態を重視します。

`packageAliases` も package 配布と紐づく設定です。`sfdx-project.json` に package name、version、package aliases を追加するには、先にこのリポジトリで package を作る判断が必要です。

`CODEOWNERS` は review owner を固定する仕組みです。このリポジトリでは、`docs/development/github-rules.md` でも CODEOWNERS 必須レビューは保留しています。

`SUPPORT.md` は外部利用者向けの support 導線です。このリポジトリは personal playground であり、公開サンプルアプリとして support policy を整える段階ではありません。

auto-assign workflow は、このリポジトリの GitHub 運用方針と合いません。assignee、label、Project などの運用 metadata は GitHub Actions で自動化せず、エージェントまたはユーザーが明示的に行います。

### 再検討条件

次のような段階になったら、個別に再検討します。

- 2GP package を作成・配布する方針を決めた。
- Dev Hub、package id、package version 管理、配布先 org などの前提を整理した。
- 外部利用者向けの support policy が必要になった。
- 複数人運用になり、CODEOWNERS による review owner 管理が必要になった。

それまでは、DreamHouse の公開サンプル・パッケージ運用向け設定は取り込まず、このリポジトリの軽量な GitHub Flow と明示的な metadata 運用を優先します。

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

## 開発コード以外の周辺設定

### 対象

`force-app` 配下のアプリケーション実装やメタデータは、この discussion では扱いません。

DreamHouse との差分として、次の周辺設定だけを確認対象にします。

- 依存バージョン
- `.vscode/extensions.json`
- Issue / PR template
- Dependabot
- release 設定

### 依存バージョン

#### 結論

DreamHouse の依存バージョンへ手動で揃える変更は、この判断では行いません。

このリポジトリでは Dependabot をすでに運用しているため、通常の npm 依存更新は Dependabot PR で差分、影響、CI 結果を確認して取り込みます。

#### 判断理由

DreamHouse は、`@salesforce/sfdx-lwc-jest`、`@salesforce/eslint-config-lwc`、`@lwc/eslint-plugin-lwc`、`eslint`、`prettier` などがこのリポジトリより新しい状態です。

ただし、依存バージョンは DreamHouse と一致させること自体が目的ではありません。このリポジトリの lint、format、LWC Jest、CI が壊れない範囲で更新できるかを確認する必要があります。

特に LWC 関連は、今後 LWC 実装とテストを追加する前提で重要ですが、バージョン更新だけを先にまとめて入れると、どの依存がどの挙動に影響したか追いにくくなります。

`@sa11y/jest` は単なるバージョン差分ではなく、LWC Jest のアクセシビリティ確認を導入するための新規依存です。そのため、依存更新ではなく `jest-sa11y-setup.js` / `@sa11y/jest` の採用 Issue で扱います。

#### 現在の方針

- DreamHouse の package version へ一括で手動追従しない。
- Dependabot PR 単位で更新内容と CI 結果を確認する。
- LWC Jest / ESLint / Prettier の major/minor 更新は、実際の LWC 実装や CI への影響を見て判断する。
- `@sa11y/jest` は LWC accessibility testing の導入作業として扱う。

### `.vscode/extensions.json`

#### 結論

DreamHouse の `.vscode/extensions.json` には揃えません。

このリポジトリでは、Salesforce DX、XML、ESLint、Prettier、Apex Replay Debugger を推奨 extension として残します。

#### 判断理由

DreamHouse は `vsls-contrib.codetour` を推奨しています。CodeTour は、サンプルアプリの案内や学習導線には向いています。

一方で、このリポジトリは Salesforce DX の開発、metadata 編集、lint、format、Apex debug を扱います。そのため、現在の推奨 extension の方が日常開発に直接効きます。

CodeTour を追加する理由は、リポジトリ内に walkthrough や onboarding tour を用意する場合です。この判断ではその運用がないため、追加しません。

#### 現在の方針

- DreamHouse の CodeTour 推奨だけに寄せない。
- 現在の Salesforce 開発向け extension 推奨を維持する。
- 将来、リポジトリ内に CodeTour 用コンテンツを置く場合だけ `vsls-contrib.codetour` を再検討する。

### Issue / PR template

#### 結論

DreamHouse の Issue / PR template は取り込みません。

このリポジトリでは、既存の日本語 template を維持します。

#### 判断理由

DreamHouse の template は、公開サンプルアプリに対する外部利用者からの bug report や feature request を受ける前提です。

このリポジトリの template は、Apex、metadata、docs、運用改善を日本語で記録し、Issue / PR に label、assignee、Project を付ける運用と合わせています。

PR template も、Issue、変更内容、確認結果、レビュー観点を明示する形になっており、このリポジトリの GitHub Flow と合っています。

#### 現在の方針

- DreamHouse の英語・外部利用者向け template へ置き換えない。
- このリポジトリの日本語 template と GitHub 運用 docs を採用する。
- 外部利用者向けの受付を始める場合だけ、template の項目追加を再検討する。

#### 参考になる要素

DreamHouse の template を日本語に置き換えると、次のような構成になります。

Bug Report は GitHub Issue Forms で、次の項目を持ちます。

- 注意書き: アプリ自体の不具合専用であり、Apex / LWC などの一般質問は外部コミュニティへ誘導する。
- 概要: 何が起きているかを短く書く。必須。
- Salesforce 組織タイプ: Scratch Org、Developer Edition Org、Trailhead Playground、Sandbox、Production Org から選ぶ。必須。
- 再現手順: どの環境、どの設定、どの操作で再現するかを書く。
- 現在の動作: 実際に起きていることを書く。
- 期待する動作: 本来どうなってほしいかを書く。
- 関連ログ: shell 出力としてログを貼る。
- Code of Conduct 確認: 行動規範への同意を必須チェックにする。

Feature Request も GitHub Issue Forms で、次の項目を持ちます。

- 注意書き: アプリ自体への機能要望専用であり、一般質問は外部コミュニティへ誘導する。
- 概要: アプリに何が足りないかを書く。必須。
- 提案する解決策: どうなってほしいかを書く。
- 代替案: 他に考えた方法や機能案を書く。
- Code of Conduct 確認: 行動規範への同意を必須チェックにする。

Pull Request template は Markdown で、次の項目を持ちます。

- この PR は何をするか。
- この PR が修正または参照する Issue は何か。
- テストを追加または更新したか。
- lint と format を実行したか。
- 変更前の動作。
- 変更後の動作。

この中で、このリポジトリでも参考になりそうなのは Bug Report の「Salesforce 組織タイプ」と、PR template の「テスト」「lint / format」の明示です。

一方で、Code of Conduct 確認、外部コミュニティへの誘導、before / after の gif 前提は、公開サンプルアプリ向けの色が強いです。このリポジトリに入れる場合は、DreamHouse の項目をそのまま移すのではなく、日本語の現行 template に必要な項目だけ足す形が自然です。

### Dependabot

#### 結論

DreamHouse の Dependabot 設定には揃えません。

このリポジトリでは、現在の weekly、label、commit message、dev dependency grouping 付きの設定を維持します。

#### 判断理由

DreamHouse の Dependabot は monthly 実行で、open pull request limit は 10 です。設定は比較的シンプルです。

このリポジトリでは、npm 依存を weekly に確認し、PR 数は 5 に抑え、`enhancement` と `area:testing` label、`chore` prefix、dev dependency grouping を付けています。

依存更新を早めに小さく見るには、現在の設定の方が扱いやすいです。特に lint、Prettier、LWC Jest 周りは品質ゲートに関係するため、更新を月次でまとめすぎない方が影響範囲を追いやすくなります。

#### 現在の方針

- DreamHouse の monthly 設定へ寄せない。
- 現在の weekly 設定を維持する。
- PR が多すぎる場合は、実際の運用負荷を見て interval、limit、grouping を調整する。

### release 設定

#### 結論

DreamHouse に合わせる release 設定はありません。

このリポジトリの `.github/release.yml` は維持します。

#### 判断理由

このリポジトリの `.github/release.yml` は、GitHub Release notes を label ごとに分類するための設定です。

分類は `enhancement`、`bug`、`documentation`、`area:apex`、`area:metadata`、`area:deployment`、`area:testing`、`area:github` など、このリポジトリの label 運用に合わせています。

DreamHouse の公開サンプル運用と release notes の粒度は、このリポジトリの label 設計とは一致しません。release notes は実際の Issue / PR label と連動するため、DreamHouse に寄せるより、このリポジトリの label taxonomy に合わせる方が自然です。

#### 現在の方針

- `.github/release.yml` はこのリポジトリの label 運用に合わせて維持する。
- DreamHouse 由来の release 設定は追加しない。
- label taxonomy を変更する場合だけ、release category も合わせて見直す。

## まとめ

今回の「設定・環境ファイル」観点では、DreamHouse との差分を一通り確認しました。

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

DreamHouse の良いところは、必要なものだけ取り込む判断ができています。

- Code Analyzer: 採用候補として Issue 化済み。
- CI の Prettier check: 採用候補として Issue 化済み。
- LWC Jest + accessibility: 採用候補として Issue 化済み。
- GitHub Release notes 設定: ナレッジ化済み。
- 不要な設定: 理由付きでこの discussion に記録済み。

その後、次の項目は導入済みになりました。

- Code Analyzer 設定: PR #72。
- CI の Prettier check: PR #73。
- LWC Jest + accessibility: PR #74。
- `sa11y` の提供元と用途の補足: PR #76。

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
