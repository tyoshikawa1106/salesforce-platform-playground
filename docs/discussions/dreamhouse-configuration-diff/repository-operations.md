# DreamHouse: リポジトリ周辺設定

[DreamHouse 設定差分の扱い](../dreamhouse-configuration-diff-policy.md)に戻る。

## packaging workflow / `packageAliases` / `CODEOWNERS` / `SUPPORT.md` / auto-assign

### 結論

DreamHouse の packaging workflow、`packageAliases`、`CODEOWNERS`、`SUPPORT.md`、auto-assign workflow は、この判断では取り込みません。

これらは、公開サンプルアプリ、パッケージ配布、外部利用者向け support、メンテナチーム運用に寄った設定です。このリポジトリの現在の目的とは前提が違います。

### 判断理由

DreamHouse の packaging workflow は、サンプルアプリを package 化し、package version を作成・検証・配布する運用を前提にしています。

このリポジトリでは、2GP package を作成・配布する方針はありません。`force-app` を基準にして、Salesforce 組織へ deploy / validate できる状態を重視します。

`packageAliases` も package 配布と紐づく設定です。`sfdx-project.json` に package name、version、package aliases を追加するには、先にこのリポジトリで package を作る判断が必要です。

`CODEOWNERS` は review owner を固定する仕組みです。このリポジトリでは、`docs/development/github-rules.md` でも CODEOWNERS 必須レビューは保留しています。

`SUPPORT.md` は外部利用者向けの support 案内です。このリポジトリは personal playground であり、公開サンプルアプリとして support policy を整える段階ではありません。

auto-assign workflow は、このリポジトリの GitHub 運用方針と合いません。assignee、label、Project などの運用 metadata は GitHub Actions で自動化せず、エージェントまたはユーザーが明示的に行います。

### 再検討条件

次のような段階になったら、個別に再検討します。

- 2GP package を作成・配布する方針を決めた。
- Dev Hub、package id、package version 管理、配布先 org などの前提を整理した。
- 外部利用者向けの support policy が必要になった。
- 複数人運用になり、CODEOWNERS による review owner 管理が必要になった。

それまでは、DreamHouse の公開サンプル・パッケージ運用向け設定は取り込まず、このリポジトリの軽量な GitHub Flow と明示的な metadata 運用を優先します。

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

DreamHouse は `vsls-contrib.codetour` を推奨しています。CodeTour は、サンプルアプリの案内や学習用途には向いています。

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

一方で、Code of Conduct 確認、外部コミュニティへの誘導、before / after の gif 前提は、公開サンプルアプリ向けの色が強いです。このリポジトリに入れる場合は、DreamHouse の項目構成に合わせるのではなく、日本語の現行 template に必要な項目だけ足す形が自然です。

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
