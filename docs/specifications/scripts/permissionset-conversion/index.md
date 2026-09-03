# Profile権限セット変換スクリプト

## 概要

設定ファイルに列挙したローカルのSalesforce Profile XMLを、ProfileごとのPermission Set metadataへ変換するNode.jsスクリプトです。実行前にSalesforce CLIのDefault Target Orgと認証済み組織情報を表示して利用者へ確認しますが、変換にはProfile XMLと同じsource treeにある関連CustomField metadataだけを使用します。

生成物は日時別フォルダへ保存します。生成後は、Default Target Orgを対象とするvalidate、dry-run、deploy、保存結果確認コマンドを表示します。変換スクリプトが実行するSalesforce CLIは接続組織の確認だけで、Profileや権限の取得、validate、deployは実行しません。

## 目的・対象外

Salesforce Platformを含むUser LicenseのProfileについて、1 Profileから1 Permission Setを生成します。Profile XMLに明示された移行可能な付与権限を維持し、無効な設定、Profile固有設定、Permission Setで表現できない設定を監査レポートへ分類します。

最小権限化、Permission Set Group化、ユーザー割り当て、元Profileの権限削除、実deployは対象外です。割り当てアプリケーション、デフォルトアプリケーション、デフォルトタブ、デフォルトレコードタイプ、Page LayoutなどのProfile固有設定も移行しません。

## 構成

| 種別           | パス                                                                   | 役割                                                                 |
| -------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 入力設定       | `scripts/permissionset-conversion/profile-paths.config.txt`            | 変換するProfile XMLの相対パスを1行ずつ指定する                       |
| 実行スクリプト | `scripts/permissionset-conversion/convert-profile-to-permissionset.js` | 入力検証、変換、日時別出力、後続コマンド表示を管理する               |
| Profile変換    | `scripts/permissionset-conversion/internal/profile-converter.js`       | Profile要素を分類してPermission Set XMLとレポートを作る              |
| Profile名解決  | `scripts/permissionset-conversion/internal/profile-resolver.js`        | ファイル名をmetadata fullName、API名、ラベルへ変換する               |
| 要素定義       | `scripts/permissionset-conversion/internal/permission-set-elements.js` | 比較対象となるPermission Set要素と識別子を定義する                   |
| 後続コマンド   | `scripts/permissionset-conversion/internal/validation-runner.js`       | validate、dry-run、deploy、保存結果確認コマンドを作る                |
| 保存結果確認   | `scripts/permissionset-conversion/verify-deployed-permissionsets.js`   | Default Target Orgからデプロイ済みPermission Setを再取得して比較する |
| テスト         | `scripts/permissionset-conversion/test/`                               | ローカル変換、異常系、保存結果比較を検証する                         |

## 入力

既定の設定ファイルは`scripts/permissionset-conversion/profile-paths.config.txt`です。

```text
# 1行に1つ指定
force-app/main/default/profiles/Admin.profile-meta.xml
force-app/main/default/profiles/Custom%3A Sales Profile.profile-meta.xml
```

空行と、前後空白を除いた後に`#`で始まる行は無視します。パスはリポジトリルートからの相対パスとし、`force-app/main/default/profiles`配下の`.profile-meta.xml`だけを受け付けます。

設定ファイルは変換ロジックではなく、今回変換するローカルProfileの選択を表します。別のsource treeで実行する場合は、そのtreeに存在するProfile XMLに合わせて一覧を更新するか、`--config`で別の設定ファイルを指定します。

## 実行方法

```sh
npm run sf:convert:profile
```

### オプション

| オプション                  | 必須 | 内容                                                             |
| --------------------------- | ---- | ---------------------------------------------------------------- |
| `--config <file>`           | 任意 | Profileパス設定ファイルを変更する                                |
| `--objects-dir <directory>` | 任意 | 関連CustomField metadataの基準directoryを変更する                |
| `--dry-run`                 | 任意 | 変換結果を表示するがファイルを生成せず、後続コマンドも表示しない |
| `--help`                    | 任意 | 使用方法を表示する                                               |

`--target-org`、`--profile-id`、`--overwrite`は受け付けません。接続組織の確認にはSalesforce CLIのDefault Target Orgを使用します。

## 名前とライセンス

- Profile metadata fullNameは、Profileファイル名から`.profile-meta.xml`を除き、percent decodeしてNFCへ正規化します。
- Permission Set API名は、fullNameがAPI名制約を満たす場合はそのまま使用します。
- 日本語、空白、記号を含むfullNameはASCII部分を正規化し、fullNameのSHA-256から作る10桁hashを付けます。
- `_Migrated`は付加しません。
- Permission SetラベルはProfile metadata fullNameを使用します。Profile XMLには組織上の表示ラベルが含まれないため、`Admin`からローカル処理だけで「システム管理者」は取得しません。
- ラベルが80文字を超える場合は、意味を変えて短縮せず変換を停止します。
- Permission Setの説明は`<Profile metadata fullName> Profileから生成した権限セット`です。
- Permission Setの`license`には、Profile XMLの`userLicense`を設定します。
- Profile IDは取得せず、変換レポートにも保存しません。

## 処理フロー

1. CLI引数、設定ファイル、Profileパス、objects directoryを検証する。
2. Default Target Orgを認証済み組織一覧から特定し、Alias、Username、URL、組織種別を表示する。
3. 利用者へ実行確認を行い、本番環境では追加確認を行う。
4. Profileファイル名をmetadata fullName、Permission Set API名、ラベルへ変換する。
5. Profile XMLを検証し、1回だけ解析する。
6. 有効なアクセス権、項目権限、オブジェクト権限、レコードタイプ、タブを変換する。
7. Profile固有設定、無効設定、要validate、未知要素を監査レポートへ分類する。
8. 未知要素がなければPermission Set XMLとレポートを日時別フォルダへ一括出力する。
9. 全Profileを生成できた場合だけ、利用者が別途実行する後続コマンドを表示する。

接続組織の確認では`sf config get target-org`と`sf org list --skip-connection-status`だけを実行します。SOQL、Metadata API、sObject describe、validate、deploy、retrieveは実行せず、組織情報をPermission Setの変換内容へ渡しません。

## 変換規則

| Profile設定                                               | Permission Setへの変換                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `enabled=true`のアクセス権                                | 対応するPermission Set要素へ出力する                                        |
| `enabled=false`                                           | 拒否権限ではないため出力しない                                              |
| `objectPermissions`                                       | Profile XMLに存在し、1件以上の`true`を持つオブジェクトだけを出力する        |
| 省略されたObject Permissionのboolean                      | Permission Setの必須子要素だけ`false`で補完する                             |
| `fieldPermissions.readable=false`                         | 出力しない                                                                  |
| ローカルmetadataで必須またはMaster-Detailと確認できる項目 | 出力せず理由を要validateへ記録する                                          |
| ローカルmetadataで数式と確認でき、`editable=true`の項目   | `editable=false`へ正規化して記録する                                        |
| 関連CustomField metadataがない項目                        | Profile XMLの権限を候補へ残し、項目特性を手動validateで確認するよう記録する |
| `tabVisibilities.DefaultOn`                               | `tabSettings.Visible`へ変換する                                             |
| `tabVisibilities.DefaultOff`                              | `tabSettings.Available`へ変換する                                           |
| `tabVisibilities.Hidden`                                  | 出力しない                                                                  |
| 表示可能なRecord Type                                     | `default`を除いて出力する                                                   |
| 割り当てアプリケーション、デフォルト指定、Layout等        | Profile残置として記録する                                                   |
| 未知の直下要素または未知の子要素                          | `unsupportedUnknown`へ記録し、Permission Set XMLを生成しない                |

ローカルProfile XMLに存在しない権限を、接続組織やライセンス名から補完・推測しません。

## 出力

```text
scripts/permissionset-conversion/outputs/<YYYYMMDD-HHmmss-SSS>/
├── permissionsets/
│   └── <Permission Set API名>.permissionset-meta.xml
└── reports/
    └── <Permission Set API名>.conversion-report.json
```

同じミリ秒のフォルダが既に存在する場合は4桁の連番を付けます。`outputs/`配下はGit管理対象外です。

変換レポートの`schemaVersion`は`2`です。入力Profileのmetadata fullName、相対パス、SHA-256、User License、生成先のAPI名、ラベル、説明、license、生成XMLのSHA-256、分類別明細と件数を記録します。

## 後続の手動操作

全XMLを生成できた場合、次のコマンドを実際の出力パス付きで表示します。すべてSalesforce CLIのDefault Target Orgを対象にします。

ProductionまたはDeveloper Editionでは次を使用します。

```sh
sf project deploy validate --source-dir scripts/permissionset-conversion/outputs/<日時>/permissionsets --test-level RunLocalTests --wait 30
```

SandboxまたはScratch Orgでは次を使用します。

```sh
sf project deploy start --dry-run --source-dir scripts/permissionset-conversion/outputs/<日時>/permissionsets --test-level RunLocalTests --wait 30
```

内容と対象組織を確認した後、通常deployを手動実行します。

```sh
sf project deploy start --source-dir scripts/permissionset-conversion/outputs/<日時>/permissionsets --wait 30
```

デプロイ後の保存値を生成XMLと比較します。

```sh
npm run sf:verify:permissionsets -- --source-dir scripts/permissionset-conversion/outputs/<日時>/permissionsets
```

保存結果確認スクリプトは、Default Target Orgから生成フォルダのPermission Set API名をexact-nameで取得します。確認後の設定変更で取得先が変わらないよう、取得したDefault Target Orgを内部のSalesforce CLIへ固定して渡しますが、利用者からの`--target-org`は受け付けません。繰り返し要素と子要素の順序、`objectPermissions.viewAllFields=false`の省略だけを無害な表記差として扱い、権限の欠落、追加、値変更は比較レポートへ記録します。
保存結果に差分があっても、対象組織で観測した値を変換処理へ自動適用しません。変換結果は常にローカルProfile XMLと関連metadataだけから生成し、組織ごとの差は比較レポートで確認します。

## エラー処理

| 条件                                               | 動作                                             |
| -------------------------------------------------- | ------------------------------------------------ |
| 設定ファイルがない、またはProfileパスが0件         | 組織へ接続せず停止する                           |
| 絶対パス、profiles外、非Profile XML、重複パス      | 組織へ接続せず停止する                           |
| Profile XML、namespace、User Licenseが不正         | 変換を停止する                                   |
| Default Target Orgまたは認証済み組織を確認できない | ファイルを生成せず停止する                       |
| 接続組織または本番環境の追加確認が承認されない     | ファイルを生成せず正常終了する                   |
| API名、ラベル、boolean値が不正                     | 推測で補正せず停止する                           |
| 項目API名またはCustomField参照先が不正             | objectsディレクトリ外を参照せず停止する          |
| 同じ権限が重複                                     | 対象API名を表示して停止する                      |
| 未知のProfile要素またはタブ状態                    | レポートへ記録し、Permission Set XMLを生成しない |
| 関連CustomField metadataがない                     | 権限候補を維持し、手動validate事項として記録する |
| 出力先が重複または処理中に作成された               | 既存ファイルを上書きせず停止する                 |
| XMLまたはレポートの出力途中で失敗                  | 今回の全一時出力と配置済み出力を削除して停止する |

## テスト・確認観点

```sh
node --test scripts/permissionset-conversion/test/*.node.js
```

主な確認内容です。

- 変換入口がDefault Target Orgと認証済み組織情報を表示し、承認後だけ処理する
- 本番環境では追加確認を行い、組織情報を変換内容には使用しない
- Profile XMLに明示された移行可能な権限を、固定件数ではなく要素名と値で比較する
- Git管理fixtureへ権限を追加した場合も、追加後のProfile XMLとの意味的一致を確認する
- Profile XMLにないObject Permissionを追加しない
- 必須、Master-Detail、数式項目をローカルmetadataから判定する
- 関連metadataがない項目を勝手に除外せず、手動validate対象として保持する
- 未知要素、未知の子要素、重複、不正XMLをfail closedで拒否する
- Profileファイル名のpercent decode、日本語API名生成、ラベル制約を確認する
- dry-runでファイルを作成せず、通常実行では日時別出力を作る
- 出力途中の失敗時にbatch全体をrollbackする
- validate、dry-run、deploy、保存結果確認コマンドが今回の出力フォルダだけを対象にする
- 保存後の意味差分を検出し、変換結果へ反映せず比較レポートへ保存する

単体テストはSalesforce CLI応答をstub化し、実組織へ接続しません。組織へのデプロイ適合性、保存値、User Licenseへの割り当て適合性は、利用者がDefault Target Orgを確認して実行する後続工程で確認します。

## 制約・確認事項

- 変換結果は入力したローカルProfile XMLと関連metadataの取得scope、取得時点に依存します。
- Profile XML単体では権限網羅性を証明できないため、関連metadataを含めてretrieveした入力か確認します。
- ローカルmetadataがない項目は候補へ残るため、deploy前のvalidateが必要です。
- Session Setting、Password Policyなど別metadata typeのProfile設定は変更しません。
- Permission Set Group化、ミューティング、最小権限化は行いません。
- API version追加要素を自動推測せず、未知要素として停止します。
- 対応Metadata API versionは、このリポジトリの`sourceApiVersion`である67.0です。
