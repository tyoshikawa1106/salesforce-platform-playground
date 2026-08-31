# メタデータ取得スクリプト

## 概要

`npm run sf:retrieve`を1回実行し、Default Target Orgから責務別のmanifestを順番に取得するNode.jsスクリプトです。取得開始前にmanifestと接続組織を確認し、各retrieveの結果、件数、warning、所要時間を表示します。

## 目的・利用場面

広いmetadataをMetadata APIの上限へ配慮して分割取得し、ローカルプロジェクトへ反映するときに使用します。取得漏れの可能性があるwarningや上限到達を成功と区別し、確認が必要なmanifestを実行結果から特定できるようにします。

## 対象実装・メタデータ

| 種別             | パスまたはファイル群                              | 役割                                                        |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| 実行スクリプト   | `scripts/metadata/retrieve/retrieve.js`           | manifest検査、組織確認、取得、結果判定、表示を行う          |
| テストスクリプト | `scripts/metadata/retrieve/test/retrieve.node.js` | manifest計画、CLI引数、結果判定、実行順と停止条件を検証する |
| 取得scope        | `manifest/retrieve-*.xml`                         | 責務別のmetadata取得対象を定義する                          |
| 共通処理         | `scripts/common/approval.js`                      | 確認入力と承認判定を提供する                                |
| 共通処理         | `scripts/common/run-command.js`                   | Salesforce CLIコマンドをOSに応じて組み立てる                |
| 共通処理         | `scripts/common/target-org.js`                    | Default Target Orgを特定して表示情報を返す                  |

## 入力

- コマンドライン引数は受け付けません。
- Salesforce CLIに設定されたDefault Target Orgを使用します。
- 取得対象と実行順は`scripts/metadata/retrieve/retrieve.js`のmanifest一覧を正とします。
- 各manifestのAPI versionは`sfdx-project.json`の`sourceApiVersion`と一致する必要があります。
- `retrieve-profile.xml`は、Profileの権限設定を取得するため、Profileと関連metadataを同じretrieve要求に含めます。
- `retrieve-translations.xml`は、翻訳内容を取得するため、`Translations`と関連metadataを同じretrieve要求に含めます。

## 処理内容

```text
manifest検査
  ↓
Default Target Orgの確認
  ↓
接続組織の承認
  ↓
manifestを定義順に取得
  ↓
manifest単位で結果を判定・表示
  ↓
全体結果を表示
```

### 1. manifestを検査する

組織へ接続する前に、すべての分割manifestについて次を確認します。

- ファイルが存在する
- `<version>`が1件ある
- `<types>`ごとに`<name>`が1件、`<members>`が1件以上ある
- 同じmanifest内でmetadata typeが重複していない
- 取得対象metadata typeが1件以上ある
- API versionが`sfdx-project.json`と一致する

検査に成功すると、manifest数、重複を除いたmetadata type数、API versionを表示します。

```text
retrieve manifest確認: 27 manifests / 217 metadata types / API 67.0
```

表示される件数は現在のmanifestから計算します。固定された組織全体のmetadata件数ではありません。

### 2. Default Target Orgを確認する

Default Target Orgを認証済み組織一覧と照合し、対象組織を表示します。

```text
接続組織を確認してください。
・Alias: my-org
・Username: user@example.com
・URL: https://example.my.salesforce.com
・Org Type: Sandbox
```

対象を特定できない場合や組織種別を判定できない場合は、retrieveを開始しません。

### 3. 接続組織を承認する

次の確認へ`y`または`Y`を入力した場合だけ続行します。

```text
この組織からメタデータを取得しますか？ [y/N]:
```

承認されなかった場合は、Salesforce CLIによるretrieveを実行せず正常終了します。

### 4. manifestを順番に取得する

各manifestについて、次に相当するコマンドを実行します。

```sh
sf project retrieve start \
  --manifest manifest/retrieve-profile.xml \
  --target-org <Default Target Org> \
  --wait 120 \
  --json
```

`--wait 120`は1 manifestの完了を最大120分待つ指定です。スクリプト全体の制限時間ではありません。実行中は30秒ごとに、現在のmanifestを開始してからの経過時間と、表示した時点のローカル日時を表示します。

```text
[1/27] retrieve-profile.xml を取得します。
・実行中: 30.0秒経過｜2026/08/31 17:26:20
```

### 5. manifest単位で結果を判定する

Salesforce CLIの終了状態とJSON結果から次を確認します。

- CLIプロセスとJSONのstatusが成功している
- JSONを解析できる
- retrieve resultがある
- `files`または`inboundFiles`で取得ファイル結果を確認できる
- Metadata APIが明示した失敗または未完了状態ではない

成功したファイルからcomponent数とsource形式のファイル数を集計します。`fileProperties`がある場合は、Metadata API形式のファイル数とmetadata type別の件数も集計します。

```text
・結果: 成功
・取得component: 120件
・取得ファイル: 240件
・API取得ファイル: 120件
・APIファイル種別: ApexClass 80件
・所要時間: 12.3秒
```

### 6. warningと失敗を処理する

- Salesforce CLI自体の案内warningは表示しますが、取得の完全性を要確認にはしません。
- Metadata APIの取得warningまたは失敗状態のファイルがある場合は要確認とし、後続manifestを続行します。
- Metadata API形式のファイル数が10,000件以上の場合は要確認とし、後続manifestを続行します。
- CLIの非0終了、解析不能なJSON、未知の成功応答、未完了状態などは失敗とし、そのmanifestで停止します。
- 自動retryや確認目的の再retrieveは行いません。

warningとmetadata type別件数は、それぞれ表示上限まで出力し、超過分は省略件数を表示します。

### 7. 全体結果を表示する

すべて成功した場合は、次を表示して終了コード`0`を返します。

```text
すべてのメタデータ取得が完了しました。
```

要確認結果がある場合は、すべてのmanifestを実行した後に対象manifestと理由をまとめ、終了コード`1`を返します。

```text
すべてのmanifestを実行しましたが、要確認の取得結果があります。
・retrieve-code.xml: 取得warning 1件を記録しました。
```

hard failureの場合は、発生したmanifestの結果を表示し、後続manifestを実行せず終了コード`1`を返します。

## 出力・更新対象

- `sfdx-project.json`で定義された既定package directory配下のmetadataを、Salesforce CLIのsource形式retrieve結果で作成または更新します。
- manifest単位の取得結果、件数、warning、注意、エラー、所要時間を標準出力または標準エラーへ表示します。
- スクリプト独自のログファイル、結果JSON、manifestコピーは作成しません。

## 権限・実行条件

- Salesforce CLIを実行できるSalesforce DXプロジェクト内で実行します。
- Default Target Orgが設定され、認証済み組織一覧から一意に確認できる必要があります。
- 接続ユーザーには、manifestに含まれるmetadataを取得できる権限が必要です。
- retrieveはローカルファイルを作成または上書きするため、実行前に未コミット差分と上書き影響を確認します。

## エラー処理

| 条件                                    | 動作                                                  |
| --------------------------------------- | ----------------------------------------------------- |
| 引数が指定された                        | CLIを呼び出さず終了コード`1`で停止する                |
| manifest検査に失敗した                  | 組織確認前に終了コード`1`で停止する                   |
| 接続組織を確認できない                  | retrieveを開始せず終了コード`1`で停止する             |
| 接続組織が承認されない                  | retrieveを開始せず終了コード`0`で終了する             |
| CLIまたはJSON結果を成功と確認できない   | 現在のmanifestで停止し終了コード`1`を返す             |
| 取得warningまたは10,000件到達を検出した | 後続を続行し、最後に対象をまとめて終了コード`1`を返す |

## 関連コンポーネント

- [メタデータ管理ルール](../../../development/metadata-rules.md)
- `sfdx-project.json`
- Salesforce CLIの`sf project retrieve start`
- Salesforce Metadata APIのretrieve

## テスト・確認観点

`scripts/metadata/retrieve/test/retrieve.node.js`を次のコマンドで実行します。

```sh
node --test scripts/metadata/retrieve/test/retrieve.node.js
```

主な確認観点は次のとおりです。

- すべての分割manifestが実行対象に含まれる
- manifestの構造とAPI versionを取得開始前に確認する
- 同じTarget Orgと`--wait 120`を全retrieveへ指定する
- warningでは後続を続行し、hard failureでは停止する
- 未完了または解析不能な応答を成功扱いしない
- 10,000件上限を要確認として扱う
- 長時間処理中に経過時間を表示し、完了後にタイマーを解除する

テストはSalesforce CLIと組織応答を模擬しています。実組織へのretrieve結果を検証するものではありません。

## 制約・注意事項

- 各manifestは独立したretrieveです。27回の取得をまたぐ一括トランザクションや同一時点の組織snapshotではありません。
- 途中で失敗しても、それ以前に完了したmanifestのローカル変更はロールバックされません。
- `--wait 120`を超過すると現在のmanifestを失敗として停止します。retrieveにはCLIのresumeまたはreportコマンドを使用しません。
- 1回のMetadata API retrieveには10,000ファイルと圧縮ZIPサイズの上限があります。10,000件未満でもサイズ上限などで失敗する可能性があります。
- manifestのmetadata type一覧は組織上の全metadata componentを保証しません。
- Profileの権限設定とTranslationsの翻訳内容は、同じretrieve要求に含めた関連metadataに依存します。manifest一覧上の先頭または末尾であることには依存しません。
- 取得後はGit差分を確認し、Salesforce側の並び替えや既定値補完と実際の設定差分を区別します。

## 既知の差異・確認事項

- 状態: 未確認（承認済み要求または外部契約との比較元を特定していません）
- Node.jsテストでは、manifest計画、CLI引数、模擬JSONによる結果判定を確認しています。
- Salesforce CLI 2.148.3、API 67.0、Developer Editionの実組織では、27個のmanifestがwarningなしですべて成功し、実際のretrieve JSONから件数とmetadata type別の内訳を解析できることを確認しています。
- Metadata APIの取得ファイル数が10,000件付近の場合と、`--wait 120`を超過する長時間retrieveの実応答は未確認です。該当する規模の組織で使用する場合は、manifest単位の結果とGit差分を確認します。
