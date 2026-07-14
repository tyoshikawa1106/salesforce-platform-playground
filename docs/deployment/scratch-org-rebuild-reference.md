# Scratch Org 再現の前提と設定

Scratch Org 再現時に確認する Installed Package、alias、Scratch definition の参照情報です。実行手順は [Scratch Org 再現ルール](scratch-org-rebuild-rules.md) を参照します。

## Installed Package の確認

Salesforce 組織の installed package は Scratch Org に自動では引き継がれません。
必要な package がある場合は、Scratch Org 作成後、metadata deploy より前に `sf package install` で明示的にインストールします。

比較元の Salesforce 組織の package は Tooling API で確認します。

```sh
sf data query \
    --use-tooling-api \
    --query "SELECT SubscriberPackage.Name, SubscriberPackage.NamespacePrefix, SubscriberPackageVersion.Name FROM InstalledSubscriberPackage" \
    --target-org <source-org-alias>
```

Package License が残っていないかも確認します。

```sh
sf data query \
    --query "SELECT NamespacePrefix, Status, AllowedLicenses, UsedLicenses FROM PackageLicense" \
    --target-org <source-org-alias>
```

package が必要な場合は、`04t...` の Package Version Id を確認し、次の順序で反映します。

```sh
sf package install --package 04tXXXXXXXXXXXXXXX --target-org <scratch-org-alias> --wait 30 --publish-wait 30
```

```text
1. Scratch Org 作成
2. 必要 package install
3. manifest/rebuild-scratch-org.xml deploy
4. Scratch Org ユーザー用 Permission Set assign
5. Apex test
```

## alias ルール

Scratch Org の alias は、個人名や用途が固定された値ではなく、通常は `scratch-org` にします。

```text
scratch-org
```

同じ日に複数の Scratch Org を作成する場合は、作成前にユーザーへ alias を確認します。
確認した alias は `SCRATCH_ORG_ALIAS` で明示します。

```sh
SCRATCH_ORG_ALIAS=<scratch-org-alias> node scripts/scratch-org/setup.js
```

作成後の deploy、retrieve、Permission Set assign、test data import、削除では、作成時に使った alias を `<scratch-org-alias>` として明示します。
報告にもこの alias を書き、ユーザー名や org 固有 URL は書きません。

## Scratch definition の扱い

`config/project-scratch-def.json` の `features` は、通常時は Scratch Org 作成に必要な最小限だけを指定します。
主要な標準オブジェクトの再現性を上げる追加 feature は、必要になった時点で目的別に追加します。
ただし、Scratch Org 作成時に Dev Hub 側で許可されているものだけが使えます。
Commerce、Industry、Loyalty、Einstein、Health Cloud、Financial Services Cloud など、契約や追加 package に強く依存する feature は、必要になった時点で個別に追加します。
`AddCustomRelationships` は、検証時点では `30` が無効な数量として失敗し、`10` で作成できました。
`TransactionFinalizers` は、検証時点では CLI schema の候補に含まれましたが、対象 Dev Hub で無効な feature として失敗したため指定していません。
これらの数量や利用可否は Dev Hub、edition、Salesforce release、CLI schema に依存するため、definition file または Dev Hub を変更するときに再確認します。
