# Salesforce API version の上げ方

Salesforce の seasonal release 後は、組織で使える API version とリポジトリの metadata version がずれることがあります。

Salesforce DX プロジェクトでは、主に次の 2 種類を確認します。

| 対象                | 例                             | 役割                                                  |
| ------------------- | ------------------------------ | ----------------------------------------------------- |
| `sourceApiVersion`  | `sfdx-project.json`            | source convert / deploy / retrieve などの基準 version |
| metadata の version | `*-meta.xml` の `<apiVersion>` | Apex class、trigger、LWC など個別 metadata の version |

## 確認すること

まず、現在接続中の組織が新しい API version を使えるか確認します。

```sh
sf config get target-org
```

alias だけでは API version を判断できないため、必要に応じて `sf org display` で対象組織の詳細を確認します。`apiVersion` が期待する version になっていれば、その組織では新しい API version を利用できます。

Salesforce CLI がローカル Node.js との相性で起動しない場合は、CLI の更新、Node.js の LTS version での実行、または別のインストール経路を確認します。CLI 起動エラーと API version 非対応は切り分けて考えます。

## 更新する場所

プロジェクト全体の version を更新します。

```json
{
    "sourceApiVersion": "67.0"
}
```

Apex class や trigger など、`*-meta.xml` に `<apiVersion>` を持つ metadata も同じ version に揃えます。

```xml
<apiVersion>67.0</apiVersion>
```

一括置換する場合は、対象が API version だけか差分で確認します。

```sh
rg -n "66\\.0|67\\.0|sourceApiVersion|<apiVersion>" sfdx-project.json force-app
git diff
```

## 検証すること

metadata versionを上げた後は、対象org alias、組織種別、利用する事前検証を確認し、組織が受け付けるか確認します。

Production 組織または実行確認済みの Developer Edition の Dev 組織では、今回versionを更新したmetadataだけをscopeにしてdeploy validateを実行します。

```sh
sf project deploy validate \
    --metadata ApexClass:MyClass \
    --metadata ApexTrigger:MyTrigger \
    --target-org <alias>
```

Sandbox と Scratch Org では、同じ scope で dry-run を実行します。

```sh
sf project deploy start \
    --dry-run \
    --metadata ApexClass:MyClass \
    --metadata ApexTrigger:MyTrigger \
    --target-org <alias> \
    --wait 30
```

versionを更新していないmetadataや依頼範囲外のmetadataをscopeに含めません。

```sh
sf project deploy validate \
    --metadata ApexClass:MyClass \
    --metadata ApexTrigger:MyTrigger \
    --target-org <alias>
```

SandboxとScratch Orgでは、上のコマンドを`sf project deploy start --dry-run`に置き換えます。事前検証が成功したら、同じ対象orgとscopeでdeployします。

```sh
sf project deploy start \
    --metadata ApexClass:MyClass \
    --metadata ApexTrigger:MyTrigger \
    --target-org <alias>
```

Apex classやtriggerを含む場合、事前検証またはPR前に関連Apexテストも確認します。

## 注意点

- `sourceApiVersion` だけを上げても、既存 metadata の `<apiVersion>` は自動では変わりません。
- 新しいAPI versionでコンパイルされるため、Apexやmetadataの挙動差分がないか事前検証／テストで確認します。
- 接続先 org を切り替えて確認する場合は、意図した org か先に確認します。
- deploy URL、access token、instance URL などの認証情報や組織固有値は、作業記録やコミットに残しません。
- 広いscopeの事前検証が失敗した場合は、既存metadata由来か、今回のversion更新による失敗かを切り分けます。

## 参考リンク

- [Salesforce Release Notes](https://help.salesforce.com/s/articleView?id=release-notes.salesforce_release_notes.htm&type=5)
- [Metadata API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta)
- [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference)
