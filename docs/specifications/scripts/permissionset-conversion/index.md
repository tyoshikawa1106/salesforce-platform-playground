# Profile権限セット変換スクリプト

## 概要

設定ファイルに列挙したローカルのSalesforce Profile XMLを、ProfileごとのPermission Set metadataへ変換するNode.jsスクリプトです。実行前にSalesforce CLIのDefault Target Orgと認証済み組織情報を表示して利用者へ確認しますが、変換にはProfile XMLと同じsource treeにある関連CustomField metadataだけを使用します。

生成物は日時別フォルダへ保存します。Permission Setは既存metadataとの更新競合を避ける一意な仮API名で生成し、組織上の保存結果を確認した後に設定画面で最終API名へ変更します。生成後は、Default Target Orgを対象とするdry-run、deploy、保存結果確認コマンドを表示します。変換スクリプトが実行するSalesforce CLIは接続組織の確認だけで、Profileや権限の取得、dry-run、deployは実行しません。

## 目的・利用場面

Salesforce Platformを含むUser LicenseのProfileについて、1 Profileから1 Permission Setを生成します。Profile XMLに明示された移行可能な付与権限を維持し、無効な設定、Profile固有設定、Permission Setで表現できない設定を監査レポートへ分類します。

最小権限化、Permission Set Group化、ユーザー割り当て、元Profileの権限削除、実deployは対象外です。デフォルトアプリケーション、デフォルトタブ、デフォルトレコードタイプ、Page LayoutなどのProfile固有設定は移行しません。割り当てアプリケーションの表示権限はPermission Setへ移行します。

## 対象実装・メタデータ

| 種別           | パス                                                                   | 役割                                                                 |
| -------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 入力設定       | `scripts/permissionset-conversion/profile-paths.config.txt`            | 変換するProfile XMLの相対パスを1行ずつ指定する                       |
| 実行スクリプト | `scripts/permissionset-conversion/convert-profile-to-permissionset.js` | 入力検証、変換、日時別出力、後続コマンド表示を管理する               |
| Profile変換    | `scripts/permissionset-conversion/internal/profile-converter.js`       | Profile要素を分類してPermission Set XMLとレポートを作る              |
| Profile名解決  | `scripts/permissionset-conversion/internal/profile-resolver.js`        | ファイル名をmetadata fullName、API名、ラベルへ変換する               |
| 要素定義       | `scripts/permissionset-conversion/internal/permission-set-elements.js` | 比較対象となるPermission Set要素と識別子を定義する                   |
| 後続コマンド   | `scripts/permissionset-conversion/internal/validation-runner.js`       | dry-run、deploy、保存結果確認コマンドを作る                          |
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

設定ファイルは変換ロジックではなく、今回変換するローカルProfileの選択を表します。`--config`で変更できるのは設定ファイルの位置だけです。Profile XMLは`force-app/main/default/profiles`配下に配置し、別のsource treeは指定できません。

### 実行方法

```sh
npm run sf:convert:profile
```

#### オプション

| オプション                  | 必須 | 内容                                                             |
| --------------------------- | ---- | ---------------------------------------------------------------- |
| `--config <file>`           | 任意 | Profileパス設定ファイルを変更する                                |
| `--objects-dir <directory>` | 任意 | 関連CustomField metadataの基準directoryを変更する                |
| `--dry-run`                 | 任意 | 変換結果を表示するがファイルを生成せず、後続コマンドも表示しない |
| `--help`                    | 任意 | 使用方法を表示する                                               |

`--target-org`、`--profile-id`、`--overwrite`は受け付けません。接続組織の確認にはSalesforce CLIのDefault Target Orgを使用します。

### 名前とライセンス

- Profile metadata fullNameは、Profileファイル名から`.profile-meta.xml`を除き、percent decodeしてNFCへ正規化します。
- Permission Set API名は、`ProfileConversion_<元ProfileのUser License>_<実行日時>_<Profile連番>`形式の仮名です。
- User Licenseの空白、記号、アンダースコアは除去し、API名で使用する英数字部分を最大32文字にします。
- 実行日時には一意な出力フォルダ名を使用します。同じProfileを再実行した場合も前回のPermission Setを更新しません。
- Profile連番は、対象外Profileを除いた生成順に1から9999まで4桁で付与します。
- 組織上の保存結果を確認した後に、Salesforce設定画面の「プロパティを編集」から最終API名へ変更します。
- Permission Setラベルは`<Profile metadata fullName> <実行日時> <4桁連番>`形式にし、API名と同じ実行識別子と連番で一意にします。
- ラベルが80文字を超える場合は、一意性を担保する末尾を維持してProfile metadata fullName部分を短縮します。Profile XMLには組織上の表示ラベルが含まれないため、`Admin`からローカル処理だけで「システム管理者」は取得しません。
- Permission Setの説明は`<Profile metadata fullName> Profileから生成した権限セット`です。
- Permission Setの`license`には、Profile XMLの`userLicense`を設定します。
- Profile IDは取得せず、変換レポートにも保存しません。

## 処理内容

Profile、関連CustomField、比較対象のPermission Set XMLは、構文検証後にXML標準の名前付き参照5種類（`amp`、`lt`、`gt`、`quot`、`apos`）と10進・16進の数値文字参照を一度だけ復号します。復号後のAPI名で重複と入力形式を検証し、生成XMLでは値を一度だけエスケープします。DTDによる独自・外部エンティティ展開を避けるため、`DOCTYPE`宣言を解析前に拒否します。コメント、CDATA、処理命令内の文字列はDTD宣言とみなしません。

### 処理フロー

1. CLI引数、設定ファイル、Profileパス、objects directoryを検証する。
2. Default Target Orgを認証済み組織一覧から特定し、Alias、Username、URL、組織種別を表示する。
3. 利用者へ実行確認を行い、本番環境では追加確認を行う。
4. Profileファイル名をmetadata fullNameとラベルへ変換し、Profile XMLを1回だけ解析する。
5. Guest User Licenseを変換対象外として表示し、残るProfileへ実行単位で一意な仮API名を生成する。
6. 有効なアクセス権、項目権限、オブジェクト権限、レコードタイプ、タブを変換する。
7. Metadata APIで明示が必要な既知の依存権限を補完する。
8. Profile固有設定、無効設定、要validate、未対応設定のスキップ、生成を止めるエラーを監査レポートへ分類する。
9. 未対応の要素・子要素はXMLから省略し、対応済み権限のXMLとレポートを日時別フォルダへ一括出力する。設定の矛盾など生成を止めるエラーがあるProfileはレポートだけを出力する。
10. 1件以上のProfileを生成できた場合だけ、利用者が別途実行する後続コマンドを表示する。

接続組織の確認では`sf config get target-org`と`sf org list --skip-connection-status`だけを実行します。SOQL、Metadata API、sObject describe、validate、deploy、retrieveは実行せず、組織情報をPermission Setの変換内容へ渡しません。

### 変換規則

| Profile設定                                                   | Permission Setへの変換                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `enabled=true`のアクセス権                                    | 対応するPermission Set要素へ出力する                                                  |
| `enabled=false`                                               | 拒否権限ではないため出力しない                                                        |
| `applicationVisibilities.visible=true`                        | 対応User Licenseでは`default`を除き、割り当てアプリケーションを出力する               |
| Assigned Apps非対応User Licenseの`visible=true`               | Permission Setへ出力せず、Profile残置と要確認へ記録する                               |
| Assigned Appsの変換対応一覧にないUser Licenseの`visible=true` | Profile残置と`unsupportedUnknown`へ記録し、Permission Set XMLを生成しない             |
| 対応User LicenseのAssigned Apps件数                           | 総件数だけで停止せず、表示アプリを出力する                                            |
| `applicationVisibilities.visible=false`                       | 拒否権限ではないため出力しない                                                        |
| `applicationVisibilities.default=true`                        | デフォルトアプリケーション指定だけをProfile残置として記録する                         |
| `ApiUserOnly=true`かつ有効な`pageAccesses`                    | Visualforceを利用できないため出力せずProfile残置として記録する                        |
| User Licenseが`Guest User License`                            | スクリプトの変換対象外とし、XMLを生成せず理由を表示する                               |
| User Licenseが`Chatter External`または`Chatter Free`          | 下記のライセンス制約対象だけを`skippedUnsupported`へ記録し、残りの権限でXMLを生成する |
| `objectPermissions`                                           | Profile XMLに存在し、1件以上の`true`を持つオブジェクトだけを出力する                  |
| `EditHtmlTemplates=true`                                      | Metadata APIが要求する`Document`の参照権限を補完する                                  |
| `EditPublicDocuments=true`                                    | Metadata APIが要求する`Document`の作成・削除・編集・参照権限を補完する                |
| `ViewAllData=true`                                            | `Document`の参照権限と`viewAllRecords=true`を補完する                                 |
| `Entitlement.allowRead=true`                                  | Metadata APIが要求する`Account`の参照権限を補完する                                   |
| 省略されたObject Permissionのboolean                          | Permission Setの必須子要素だけ`false`で補完する                                       |
| `fieldPermissions.readable=false`                             | 出力しない                                                                            |
| ローカルmetadataで必須またはMaster-Detailと確認できる項目     | 出力せず理由を要validateへ記録する                                                    |
| ローカルmetadataで数式と確認でき、`editable=true`の項目       | `editable=false`へ正規化して記録する                                                  |
| 関連CustomField metadataがない項目                            | 定義不足の通知は出さず、Profile XMLの参照・編集権限をそのまま出力する                 |
| `tabVisibilities.DefaultOn`                                   | `tabSettings.Visible`へ変換する                                                       |
| `tabVisibilities.DefaultOff`                                  | `tabSettings.Available`へ変換する                                                     |
| `tabVisibilities.Hidden`                                      | 出力しない                                                                            |
| 表示可能なRecord Type                                         | `default`を除いて出力する                                                             |
| デフォルトタブ、デフォルトレコードタイプ、Layout等            | Profile残置として記録する                                                             |
| 未対応の直下要素または子要素                                  | 当該要素だけを省略して`skippedUnsupported`へ記録し、対応済み権限のXMLを生成する       |
| 未対応のタブ表示状態                                          | 当該タブを省略して`skippedUnsupported`へ記録し、ほかの権限のXMLを生成する             |
| タブ表示状態の欠落・不正な型                                  | `unsupportedUnknown`へ記録し、Permission Set XMLを生成しない                          |

接続組織やライセンス名から権限を補完・推測しません。ローカルProfile XMLに存在しない権限を追加するのは、上表に明記したMetadata APIの依存権限だけです。

### Profile全体の変換対象外

Guest User Licenseは本スクリプトの対応範囲外です。製品固有の`Field Service Guest User`等へ、この除外を名前の部分一致で拡大しません。

### Chatterのライセンス別変換

`Chatter Free`と`Chatter External`はProfile単位では除外しません。元の`userLicense`を維持し、次の付与だけをライセンス制約として省略します。

- アプリケーション表示権限（`applicationVisibilities.visible=true`）
- 項目権限（`fieldPermissions.readable=true`）
- タブ設定（`tabVisibilities`の`DefaultOn`・`DefaultOff`）
- 有効なシステム権限の`AssignTopics`・`CreateTopics`・`EditTopics`

省略した各設定は`skippedUnsupported`に、設定名、理由、User License、解析後の元の値を記録します。`reason`は`userLicenseDoesNotAllowPermission`、`action`は`omitted`です。無効な設定は従来どおり`skippedDisabled`へ分類し、値の不正・重複・矛盾の検出は省略しません。

その他の権限は通常の変換規則に従います。`AddDirectMessageMembers`と`RemoveDirectMessageMembers`などの入力に存在する権限は維持し、未知のシステム権限をライセンス名だけで除外しません。`Chatter Only`・`Chatter Plus`へこの制約を適用しません。

制約対象はMetadata API 67.0のdry-runによる拒否結果に基づきます。Chatterの現在の入力3 Profileは、通常のCLIで生成したXMLを変更せずdry-runに成功しています。dry-run成功は実保存やユーザー割り当て、実アクセスの確認とは区別します。

### Assigned Appsのライセンス別変換

Chatter Free・Chatter ExternalのAssigned Appsは上記のスキップとして記録します。それ以外の次のUser LicenseはPermission SetのAssigned Appsを許可しないため、アプリケーションの表示権限をProfileに残します。

- `Authenticated Website`
- `Customer Community`
- `Customer Community Login`
- `Customer Community Plus`
- `Customer Community Plus Login`
- `Customer Portal Manager Custom`
- `Customer Portal Manager Standard`
- `External Apps`
- `External Apps Login`
- `External Identity`
- `High Volume Customer Portal`
- `Overage Authenticated Website`
- `Overage Customer Portal Manager Custom`
- `Overage Customer Portal Manager Standard`
- `Overage High Volume Customer Portal`
- `Work.com Only`

Overage系User Licenseは、対応する通常ライセンスとログイン量以外が同等であるというSalesforce Helpの説明に基づき、通常ライセンスと同じ非対応方針にします。

Assigned Appsを出力するのは、現在の組織で生成結果のdry-runに成功した次のUser Licenseだけです。

- `Analytics Cloud Integration User`
- `Force.com - App Subscription`
- `Force.com - Free`
- `Gold Partner`
- `Identity`
- `Partner App Subscription`
- `Partner Community`
- `Partner Community Login`
- `Salesforce`
- `Salesforce Integration`
- `Salesforce Platform`
- `Silver Partner`

`Salesforce Platform Login`は、`Salesforce Platform`と同じ機能およびアクセスを持つというSalesforce Helpの説明に基づき、同じ方針で変換します。`Force.com - App Subscription`を含め、標準アプリとカスタムアプリを合算した表示件数に固定上限を適用しません。対応User Licenseの表示アプリは出力し、契約上限や既存割り当てに関する一律の注意書きは画面・レポートへ出力しません。

上記の対応・非対応・同等関係を確認できないUser Licenseに`visible=true`のアプリケーションがある場合は、推測でAssigned Appsを出力せず変換を停止します。表示アプリケーションがない場合は、Assigned Appsの移行対象がないため、ほかの権限の変換を続行します。この判定はアプリアクセスだけに適用します。ライセンスの契約機能、アプリケーション種別、ユーザーへ割り当て済みの権限セットをローカルProfile XMLだけでは判定できないため、生成後のdry-runとユーザー割り当て時のライセンス上限確認は省略しません。

判断根拠はSalesforce Helpの[Standard User Licenses](https://help.salesforce.com/s/articleView?id=platform.users_license_types_available.htm&language=en_US&type=5)、[Salesforce Platform Login License Details](https://help.salesforce.com/s/articleView?id=platform.users_license_types_salesforce_platform_login.htm&language=en_US&type=5)、[Legacy Portal Licenses](https://help.salesforce.com/s/articleView?id=platform.users_license_types_portal.htm&language=en_US&type=5)、[Authenticated Website User Licenses](https://help.salesforce.com/s/articleView?id=platform.users_license_types_platformportal.htm&language=en_US&type=5)です。

## 出力・更新対象

```text
scripts/permissionset-conversion/outputs/<YYYYMMDD-HHmmss-SSS>/
├── permissionsets/
│   └── <Permission Set仮API名>.permissionset-meta.xml
└── reports/
    └── <Permission Set仮API名>.conversion-report.json
```

同じミリ秒のフォルダが既に存在する場合は4桁の連番を付けます。`outputs/`配下はGit管理対象外です。

変換レポートの`schemaVersion`は`3`です。入力Profileのmetadata fullName、相対パス、SHA-256、User License、生成先のAPI名、ラベル、説明、license、生成XMLのSHA-256、分類別明細と件数を記録します。

`skippedUnsupported`は未対応の要素・子要素・タブ表示状態、またはChatterのライセンス制約対象を省略した明細です。設定名、理由、解析後の元の値を記録します。子要素は親の設定名と`childElement`で識別します。スキップだけなら終了コードは0で、通常実行は「生成成功・スキップあり」と表示し、後続の手動コマンドも表示します。dry-runではスキップを表示しますがファイルは生成しません。`unsupportedUnknown`は設定の矛盾やAssigned Appsのライセンス対応範囲など、XML生成を止める明細として維持します。

未対応判定はXML要素名やタブ表示状態に対して行います。組織独自のカスタムオブジェクト名・カスタム項目名を未対応要素として扱いません。スキップした設定は生成XMLに含まれないため、生成成功と全設定の移行完了は区別します。

項目定義ファイルがないことだけを理由とした通知は、画面・レポートのいずれにも出しません。元Profileの参照・編集設定をそのままXMLへ出力し、通常の変換済み明細に含めます。生成後のdry-run手順は変わりません。

### 後続の手動操作

全XMLを生成できた場合、次のコマンドを実際の出力パス付きで表示します。すべてSalesforce CLIのDefault Target Orgを対象にします。

Permission SetだけをApexテストなしで検証するため、組織種別にかかわらず次を使用します。`--test-level`は指定しません。

```sh
sf project deploy start --dry-run --source-dir scripts/permissionset-conversion/outputs/<日時>/permissionsets --wait 30
```

内容と対象組織を確認した後、通常deployを手動実行します。

```sh
sf project deploy start --source-dir scripts/permissionset-conversion/outputs/<日時>/permissionsets --wait 30
```

デプロイ後の保存値を生成XMLと比較します。

```sh
npm run sf:verify:permissionsets -- --source-dir scripts/permissionset-conversion/outputs/<日時>/permissionsets
```

保存結果確認後に、Salesforce設定画面で対象Permission Setの「プロパティを編集」を開き、仮API名を最終API名へ変更します。API名変更後は生成XMLの仮API名と一致しなくなるため、保存結果確認スクリプトは変更前に実行します。

保存結果確認スクリプトは、Default Target Orgから生成フォルダのPermission Set API名をexact-nameで取得します。確認後の設定変更で取得先が変わらないよう、取得したDefault Target Orgを内部のSalesforce CLIへ固定して渡しますが、利用者からの`--target-org`は受け付けません。繰り返し要素と子要素の順序、同じ文字を表すXML文字参照、`objectPermissions.viewAllFields=false`の省略を無害な表記差として扱い、権限の欠落、追加、値変更は比較レポートへ記録します。
保存結果に差分があっても、対象組織で観測した値を変換処理へ自動適用しません。変換結果は常にローカルProfile XMLと関連metadataだけから生成し、組織ごとの差は比較レポートで確認します。

生成元フォルダにPermission Set XMLがない場合は、組織への接続前に入力エラーとして停止します。retrieve成功後の再取得先が存在しない場合、空の場合、対象XMLが0件の場合は、生成元の全対象を`missingPermissionSetInOrg`として比較レポートへ保存し、終了コード1を返します。読み取りエラーや不正なXMLは欠落として扱わずエラーにします。

## 権限・実行条件

- Node.jsとSalesforce CLIが利用でき、Default Target Orgが認証済み組織一覧から特定できる必要があります。
- 変換時はローカルProfileと関連項目の読み取り権限、出力先への書き込み権限が必要です。変換ロジックは組織へ接続しません。
- 保存結果確認では対象組織からPermission Set metadataをretrieveできる権限が必要です。deployとユーザー割り当ては別途実行する操作です。

## エラー処理

| 条件                                                 | 動作                                                     |
| ---------------------------------------------------- | -------------------------------------------------------- |
| 設定ファイルがない、またはProfileパスが0件           | 組織へ接続せず停止する                                   |
| 絶対パス、profiles外、非Profile XML、重複パス        | 組織へ接続せず停止する                                   |
| Profile XML、namespace、User Licenseが不正           | 変換を停止する                                           |
| Profile、関連CustomField、比較XMLにDOCTYPE宣言がある | 独自・外部エンティティを展開せず停止する                 |
| Default Target Orgまたは認証済み組織を確認できない   | ファイルを生成せず停止する                               |
| 接続組織または本番環境の追加確認が承認されない       | ファイルを生成せず正常終了する                           |
| API名、ラベル、boolean値が不正                       | 推測で補正せず停止する                                   |
| 項目API名またはCustomField参照先が不正               | objectsディレクトリ外を参照せず停止する                  |
| 同じ権限が重複                                       | 対象API名を表示して停止する                              |
| 未対応のProfile要素・子要素・タブ表示状態            | 当該設定を省略してレポートへ記録し、生成を継続する       |
| 項目権限の矛盾・タブ表示状態の欠落や不正な型         | レポートへ記録し、対象ProfileのXMLを生成しない           |
| 関連CustomField metadataがない                       | 権限を維持し、定義不足の通知は記録しない                 |
| 出力先が重複または処理中に作成された                 | 既存ファイルを上書きせず停止する                         |
| XMLまたはレポートの出力途中で失敗                    | 今回作成した一時出力と配置済み出力だけを削除して停止する |

## 関連コンポーネント

- `fast-xml-parser`：XML構文検証、文字参照の復号、Permission Set XML生成に使用します。
- [組織操作ルール](../../../deployment/org-operation-rules.md)：後続のdry-run、deploy、retrieveの対象確認と操作境界に従います。

## テスト・確認観点

```sh
node --test scripts/permissionset-conversion/test/*.node.js
```

主な確認内容です。

- 変換入口がDefault Target Orgと認証済み組織情報を表示し、承認後だけ処理する
- 本番環境では追加確認を行い、組織情報を変換内容には使用しない
- Profile XMLに明示された移行可能な権限を、固定件数ではなく要素名と値で比較する
- 表示可能な割り当てアプリケーションを移行し、デフォルトアプリケーション指定だけをProfileへ残す
- Assigned Apps非対応User LicenseとOverage系同等ライセンスではアプリケーション表示権限をProfileへ残す
- dry-run確認済みまたは公式Helpで同等のUser LicenseだけAssigned Appsを移行する
- Assigned Appsの変換対応一覧にないUser Licenseの表示アプリがある場合は生成を止める
- 対応User Licenseでは標準アプリを含む表示総件数から上限を推測せず、割り当て適合性を確認事項へ残す
- XMLの名前付き参照と数値文字参照を復号し、API名、ライセンス、重複判定、保存結果比較へ適用する
- Profile、関連CustomField、比較するPermission SetのDOCTYPEを拒否し、コメントやCDATA内の文字列は誤検知しない
- `ApiUserOnly=true`ではVisualforceページだけを除外し、ApexクラスとAPI専用権限を維持する
- ライセンス名や無効な`ApiUserOnly`からVisualforceページアクセスを除外しない
- Git管理fixtureへ権限を追加した場合も、追加後のProfile XMLとの意味的一致を確認する
- 明示したUser Permission依存以外では、Profile XMLにないObject Permissionを追加しない
- `EditPublicDocuments`からMetadata APIが要求する`Document` CRUDだけを依存権限として補完する
- `EditHtmlTemplates`からMetadata APIが要求する`Document`参照権限だけを補完する
- `ViewAllData`から`Document`の参照権限と全レコード参照権限だけを重複なく補完する
- `Entitlement`の参照権限から`Account`の参照権限だけを重複なく補完する
- 必須、Master-Detail、数式項目をローカルmetadataから判定する
- 関連metadataがない項目を勝手に除外せず、手動validate対象として保持する
- 未対応要素・子要素・タブ表示状態はスキップして記録し、対応済み権限を生成する
- 未対応の子要素があっても、対応済みの子要素は従来どおり変換する
- スキップだけならXML・レポート・後続コマンドを生成し、終了コード0を返す
- スキップと矛盾した設定が混在しても、矛盾による生成停止を維持する
- 重複、不正XML、必須設定の欠落は引き続き拒否する
- Metadata APIで必須のアプリケーションとレコードタイプの`default`値がない入力を拒否する
- Profileファイル名のpercent decode、User Licenseの正規化と文字数制限、一意なラベル制約を確認する
- 実行ごと、Profileごとに異なる仮API名を生成する
- 同じUser LicenseのProfileを同時に変換してもProfile連番でAPI名が重複しない
- Guest User LicenseのProfileだけを除外し、Chatterを含む生成対象へ連続するProfile連番を付ける
- Chatterのライセンス制約対象だけを省略し、その他の権限・依存ペア・元のライセンスを維持する
- 通常のCLIでChatterのXMLとスキップ明細を生成し、無効設定や入力エラーを制約による省略と区別する
- dry-runでファイルを作成せず、通常実行では日時別出力を作る
- 最終配置は完成した一時ファイルのハードリンクを排他的に作成し、存在確認後の競合でも既存ファイルを上書きしない
- 出力途中の失敗時にbatch全体をrollbackし、他実行の一時ファイルは削除しない
- 再取得先の不存在・空・対象XMLなしを欠落として記録し、CLIでもレポート保存後に終了コード1を返す
- 生成元の空入力と再取得先の読み取りエラーは、欠落との混同なく拒否する
- dry-run、deploy、保存結果確認コマンドが今回の出力フォルダだけを対象にする
- 保存後の意味差分を検出し、割り当てアプリケーションの順序差を無視して、変換結果へ反映せず比較レポートへ保存する

単体テストはSalesforce CLI応答をstub化し、実組織へ接続しません。組織へのデプロイ適合性、保存値、User Licenseへの割り当て適合性は、利用者がDefault Target Orgを確認して実行する後続工程で確認します。

## 制約・注意事項

- 変換結果は入力したローカルProfile XMLと関連metadataの取得scope、取得時点に依存します。
- 入力Profileは、関連metadataを含めてretrieveし、最新にした状態で使用します。この利用前提について、画面・レポートへ一律の注意は出しません。
- ローカルmetadataがない項目は候補へ残るため、deploy前のvalidateが必要です。
- Session Setting、Password Policyなど別metadata typeのProfile設定は変更しません。
- Permission Set Group化、ミューティング、最小権限化は行いません。
- API version追加要素を自動推測せず、未対応要素としてスキップしレポートへ記録します。
- 対応Metadata API versionは、このリポジトリの`sourceApiVersion`である67.0です。

## 既知の差異・確認事項

- 未確認：契約ごとのアプリ数上限、アプリ種別、割り当て済みの権限セットを合算したライセンス適合性は、ローカルProfile XMLから証明できません。対象組織の契約・設定を確認し、dry-runとユーザー割り当て時に検証します。
- 未確認：生成した権限と組織の最終保存値の一致は、deploy後の保存結果確認スクリプトで検証します。ローカルテストの成功は実組織への適合性を保証しません。
