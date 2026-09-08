# Salesforce retrieveのワイルドカードと具体名取得の検証

調査時点: 2026年9月8日。Salesforce CLI 2.149.9、Metadata API 67.0、既存認証のDeveloper Editionで確認した記録です。

## 調査の結論

retrieveが成功し、warningがなくても、取得対象を網羅しているとは限りません。対象が存在しない場合と、指定方法が適切でなく対象が返らない場合のどちらも、成功・0件になることがありました。

| 対象 | 比較結果 | 判断 |
| --- | --- | --- |
| StandardValueSet | `*` は0件、具体名では選択肢の値を含む定義を取得 | 取得漏れを実証し、具体名指定へ修正 |
| EmailTemplate | `*` は0件、具体名では16テンプレート・32ファイルを取得 | 取得漏れを実証し、具体名指定へ修正 |
| その他の独立した10種別 | ローカルも実取得も0件。比較できる実体を特定できず | `*` 非対応を実証できていないため変更を保留 |

レポート、ダッシュボード、リストビューは追加調査の評価対象外としました。調査で使用した比較取得は一時プロジェクトで行い、組織に検証用設定を作成していません。

## ローカルにファイルがなくても対象名を調べられる理由

組織への対象名の照会と、定義・本文のretrieveは別の操作です。取得済みファイルから名前を推測したのではなく、CLIを通して組織へ照会し、返された名前をmanifestに記載しました。

```text
組織へ対象名を照会
  → 具体名をmanifestに列挙
  → manifestを使って定義・本文をretrieve
  → 対象名、取得件数、ファイル内容を照合
```

一覧照会が空であることも、必ずしも対象の不存在を意味しません。StandardValueSetは、通常のMetadata APIの一覧照会とは異なる仕組みでCLIが列挙しています。

## 標準選択リストの列挙と取得

以下は調査時のコマンドを汎用化した例です。`my-org` は確認済みの接続先aliasに置き換えます。macOS / Linuxのシェルを想定しています。

Salesforce DXプロジェクト内で、一時出力先を作り、対象名のmanifestを生成します。

```sh
retrieve_audit_dir=$(mktemp -d)

SF_DISABLE_LOG_FILE=true SF_LIST_METADATA_BATCH_SIZE=10 \
sf project generate manifest \
  --from-org my-org \
  --metadata StandardValueSet \
  --api-version 67.0 \
  --name standard-valuesets.xml \
  --output-dir "$retrieve_audit_dir" \
  --json
```

`SF_LIST_METADATA_BATCH_SIZE` は並行照会の件数を制限します。`SF_DISABLE_LOG_FILE` はCLIのログファイル出力を抑える設定で、取得範囲は変えません。どちらもこのコマンドだけに適用しています。

調査時のCLI実装では、通常の `listMetadata(StandardValueSet)` が空を返す問題を回避するため、CLIが持つ既知の候補名からTooling APIのStandardValueSetを照会していました。調査では142候補から48種類が列挙されました。組織の全名称を無条件に探索する仕組みではなく、CLIの候補にない対象の網羅性は保証しません。

生成されるmanifestには、次のような具体名が入ります。

```xml
<types>
    <members>CaseStatus</members>
    <members>CaseOrigin</members>
    <members>CasePriority</members>
    <members>CaseReason</members>
    <name>StandardValueSet</name>
</types>
```

最初の比較では、この4種類を具体名で取得でき、`StandardValueSet:*` では0件でした。その後、列挙された48種類を取得定義へ反映し、48ファイルを確認しました。

生成manifestからの取得例です。実行したプロジェクトのpackage directoryへファイルを作成・更新するため、比較調査では既存作業と分離した一時Salesforce DXプロジェクト内で実行します。

```sh
SF_DISABLE_LOG_FILE=true sf project retrieve start \
  --manifest "$retrieve_audit_dir/standard-valuesets.xml" \
  --target-org my-org \
  --wait 120 \
  --json
```

既存の選択リストに値を追加・変更した場合、同じStandardValueSet名の次回retrieveで取得できます。選択肢を変更するたびにmanifestを書き換える必要はありません。manifestにない別のStandardValueSetを新たに取得対象にする場合は、名前の追加が必要です。

## メールテンプレートの列挙と取得

メールテンプレートはフォルダごとに対象名を照会します。フォルダを探す場合のコマンドと、公開未整理フォルダ内を照会するコマンドは次のとおりです。

```sh
SF_DISABLE_LOG_FILE=true sf org list metadata \
  --metadata-type EmailFolder \
  --target-org my-org \
  --api-version 67.0 \
  --json

SF_DISABLE_LOG_FILE=true sf org list metadata \
  --metadata-type EmailTemplate \
  --folder 'unfiled$public' \
  --target-org my-org \
  --api-version 67.0 \
  --json
```

`unfiled$public` は公開未整理フォルダのAPI名です。フォルダ一覧に出るカスタムフォルダだけでなく、このフォルダも照会対象にします。他のフォルダは `--folder` にそのAPI名を渡します。取得できる範囲は接続ユーザーの参照権限にも依存します。

応答の `fullName` にある `フォルダ名/テンプレート名` を、EmailTemplateのmembersへ記載します。次は調査で取得したテンプレートの1件を使ったmanifest例です。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>unfiled$public/SalesNewCustomerEmail</members>
        <name>EmailTemplate</name>
    </types>
    <types>
        <members>unfiled$public</members>
        <name>EmailFolder</name>
    </types>
    <types>
        <members>unfiled$public</members>
        <name>EmailTemplateFolder</name>
    </types>
    <version>67.0</version>
</Package>
```

この例を一時プロジェクトの `email-templates.xml` に保存した場合、取得コマンドは次のとおりです。

```sh
SF_DISABLE_LOG_FILE=true sf project retrieve start \
  --manifest email-templates.xml \
  --target-org my-org \
  --wait 120 \
  --json
```

フォルダの指定だけでは、中の全テンプレートを取得する指定にはなりません。調査時のCLIでは、EmailTemplateを具体名にしてもEmailFolderまたはEmailTemplateFolderに `*` が残ると、Metadata API用の要求へ変換する際にEmailTemplateの具体名が `*` へ置き換わりました。フォルダ型も具体名にすることで、16テンプレートの本文と設定、計32ファイルを取得できました。

### `$` と引用符の違い

XMLでは `$` のエスケープは不要です。`unfiled$public` とそのまま記述し、バックスラッシュを付けません。

シェルの `'unfiled$public'` は、`$public` が変数として展開されることを防ぐための単一引用符です。引用符はCLIへ渡す名前やXMLの内容には含まれません。

既存テンプレートの本文・設定変更は、同じ具体名の次回retrieveで取得します。新しいテンプレートやフォルダが増えた場合は再度一覧を確認し、manifestへ追加します。今回の修正は具体名を保存する方式であり、通常の一括retrieve中に一覧を自動更新する方式ではありません。

## その他のワイルドカード指定の実確認

公式ガイドで非対応とされていても、実際の取得結果とは区別して判断しました。

### 独立した10種別

次の10種類はローカルに対応ファイルがなく、まとめて `*` を指定した実取得も成功・warningなし・0ファイルでした。

| 種別 | 別APIによる件数確認 |
| --- | --- |
| Document | 標準APIのCOUNTで0件 |
| CustomNotificationType | 標準APIのCOUNTで0件 |
| EmailServicesFunction | 標準APIのCOUNTで0件 |
| IPAddressRange | 標準APIのCOUNTで0件 |
| MobileApplicationDetail | 標準APIのCOUNTで0件 |
| EmbeddedServiceBranding | Tooling APIのCOUNTで0件 |
| EmbeddedServiceConfig | Tooling APIのCOUNTで0件 |
| EmbeddedServiceMenuSettings | Tooling APIのCOUNTで0件 |
| AnalyticSnapshot | Metadata API一覧は0件。別APIでの存在確認は未完了 |
| Letterhead | Metadata API一覧は0件。別APIでの存在確認は未完了 |

件数照会の例です。本文や設定の実値を読み出さず、存在確認を行いました。

```sh
SF_DISABLE_LOG_FILE=true sf data query \
  --query 'SELECT COUNT() FROM CustomNotificationType' \
  --target-org my-org \
  --api-version 67.0 \
  --json

SF_DISABLE_LOG_FILE=true sf data query \
  --query 'SELECT COUNT() FROM EmbeddedServiceConfig' \
  --use-tooling-api \
  --target-org my-org \
  --api-version 67.0 \
  --json
```

接続ユーザーから見える範囲で比較対象の実体を特定できず、「存在するのに `*` では取得できない」とは実証できませんでした。現時点ではこの10種類の指定を変更せず、設定が存在する時点で具体名取得と比較する判断としました。これは取得の完全性を確認済みという意味ではありません。

### 親を指定すると取得される子要素

`CustomField`、`RecordType`、`Index`、`SharingReason`、`ValidationRule`、`WebLink` は公式ガイドでは単独の `*` が非対応です。ただし親CustomObjectを取得すると、その子要素も返ります。

比較では `CustomField:*`、`ValidationRule:*`、`WebLink:*` の要求で、CLIが追加したカスタムオブジェクト1件と項目14件が返りました。一方、標準オブジェクトのAccountとUserを具体名指定すると、項目82件、リンク1件、入力規則1件が返りました。現在のProfile用manifestには両親があり、確認したリンクと入力規則を一括取得の欠落とは判定しませんでした。

`CustomObject:*` 自体も標準オブジェクトすべてを表しません。調査時のmanifestは標準オブジェクト42名を別に列挙していました。列挙されていない標準オブジェクトまで取得を保証する指定ではありません。

### その他の留保

- `BusinessProcess` の `*` は公式ではRecordType指定が条件です。親や関連要素を含む要求全体で判断する必要があります。
- `IframeWhiteListUrlSettings` は公式の非対応記載に対し、実際には `*` と具体名で同じ1ファイルを取得できました。
- `CustomIndex`、`SearchOrgWideObjectConfig`、`LeadConvertSettings` は仕様記載に曖昧さがあり、実体での比較もできていません。`EmbeddedServiceFlowConfig` は後続の別種別の説明を混同せず、非対応とは断定しませんでした。
- CustomObjectTranslationは関連CustomObjectとLayoutを同時指定すると項目翻訳14ファイルが追加されましたが、すべて未翻訳のひな形でした。翻訳済み文字列の欠落を確認した結果ではなく、`*` 非対応の問題とも分けて扱いました。

## 取得結果の確認と反映

StandardValueSetの48ファイルとメールテンプレートの32ファイルは、取得後に内容を確認しました。実ユーザーのメールアドレス、組織固有ユーザー名、認証情報の実値は検出されませんでした。差し込み項目は実データと区別し、サンプルテンプレート内の固定電話番号は公開サンプルとの一致を確認しました。この結果は他の組織や将来の取得ファイルの安全性を保証するものではありません。

修正は種別ごとにローカルコミットへ分割し、manifest、取得ファイル、関連テスト、現行仕様を反映しました。追加の10種別に対する変更は行っていません。

## 参考資料

- [Salesforce Metadata API Developer Guide](https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/api_meta.pdf): 各型のWildcard Support、DocumentとEmailTemplateの取得説明
- [Salesforce CLI: project generate manifest](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_generate_manifest.html): 組織からの対象名列挙と並行照会の制御
- [Salesforce CLI: org list metadata](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_org_list_metadata.html): 型・フォルダを指定する一覧照会
- [Salesforce CLI: project retrieve start](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_retrieve_start.html): manifestによる取得
- [source-deploy-retrieve: connectionResolver](https://github.com/forcedotcom/source-deploy-retrieve/blob/main/src/resolve/connectionResolver.ts): StandardValueSet列挙処理。調査時はインストール済みCLIに同梱された実装も確認
- [公開メールテンプレートサンプル](https://soft-builder.com/en/docs/SamplesDocs/AbstraLinxDocumentation/email%20templates/e11.html): SalesNewCustomerEmail内の固定電話番号との照合先
- [メタデータ取得スクリプト仕様](../specifications/scripts/metadata-retrieve/index.md): 現行実装の参照先
