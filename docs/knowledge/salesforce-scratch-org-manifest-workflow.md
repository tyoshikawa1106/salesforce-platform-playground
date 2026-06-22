# Scratch Org と manifest の使い分け

Salesforce DX で Scratch Org を使う場合、manifest は用途ごとに分けます。
同じ XML をすべての retrieve / deploy に使うと、不要な標準メタデータや組織固有設定を混ぜやすくなります。

## 役割

| 用途                            | 役割                                                                |
| ------------------------------- | ------------------------------------------------------------------- |
| Scratch Org 初期反映用 manifest | ローカルの metadata を Scratch Org に投入する範囲を固定する         |
| 作業対象 manifest               | Scratch Org で作成、変更する metadata だけを retrieve / deploy する |
| 広い調査用 manifest             | org の状態や取得可否を調べるために一時的に使う                      |

Scratch Org 初期反映用 manifest は、Scratch Org を作り直すためのものです。
Scratch Org で作業した変更を別 org へ戻す用途には使いません。

作業対象 manifest は、作業開始前に対象 scope を決めて用意します。
Scratch Org からローカルへ retrieve するときも、ローカルから別 org へ deploy するときも同じ scope を使います。

## 基本フロー

Scratch Org で作業した metadata を別 org へ反映する場合は、Scratch Org から直接別 org へ deploy しません。
いったんローカルへ retrieve し、Git 差分を確認してから deploy します。

```text
Scratch Org -> local source -> target org
```

作業対象 manifest を使って Scratch Org から retrieve します。

```sh
sf project retrieve start --manifest manifest/<work>.xml --target-org <scratch-org>
```

retrieve 後に Git 差分を確認します。

```sh
git status
git diff
```

別 org へ反映する場合は、同じ作業対象 manifest で dry-run してから deploy します。

```sh
sf project deploy start --dry-run --manifest manifest/<work>.xml --target-org <target-org> --wait 30
sf project deploy start --manifest manifest/<work>.xml --target-org <target-org> --wait 30
```

## Apex 開発から Dev 組織へのリリース

Scratch Org で Apex を開発し、Dev 組織へリリースする場合も、変更は Git を経由させます。
Scratch Org は開発とテストの場所、Dev 組織はリリース先として扱います。

まず、Dev 組織やローカルの現在の metadata を Scratch Org に反映します。
この初期反映には Scratch Org 初期反映用 manifest を使います。

```sh
sf project deploy start --dry-run --manifest manifest/<scratch-rebuild>.xml --target-org <scratch-org> --wait 30
sf project deploy start --manifest manifest/<scratch-rebuild>.xml --target-org <scratch-org> --wait 30
```

次に、Scratch Org で Apex を作成、変更します。
変更対象が決まっている場合は、作業対象 manifest を用意します。

```xml
<types>
    <members>MyService</members>
    <members>MyServiceTest</members>
    <name>ApexClass</name>
</types>
```

Scratch Org からローカルへ取り込みます。

```sh
sf project retrieve start --manifest manifest/<work>.xml --target-org <scratch-org>
```

取り込んだら、必ず Git 差分を確認します。

```sh
git status
git diff
```

Apex テストは Scratch Org で先に実行します。

```sh
sf apex run test --test-level RunLocalTests --result-format human --target-org <scratch-org> --wait 30
```

Dev 組織へ出す前に、同じ作業対象 manifest で dry-run します。

```sh
sf project deploy start --dry-run --manifest manifest/<work>.xml --target-org <dev-org> --wait 30
```

dry-run が成功したら、Dev 組織へ deploy します。

```sh
sf project deploy start --manifest manifest/<work>.xml --target-org <dev-org> --wait 30
```

DevOps Center を使う場合も考え方は同じです。
Scratch Org の変更を Git に戻し、Pull Request や Work Item の単位で Dev 組織へ昇格します。
Scratch Org 初期反映用 manifest を、Dev 組織へ戻す変更 scope として使い回しません。

## 入口で絞る

Scratch Org から `force-app` 全体を retrieve すると、今回の作業ではない差分が混ざることがあります。
特に標準メタデータ、組織固有設定、更新不可コンポーネントはノイズになりやすいです。

そのため、取り込み時点で作業対象 manifest を指定して scope を絞ります。
retrieve 後の Git 差分をそのまま全部 deploy manifest に変換する運用にはしません。

## 広い dry-run の位置づけ

広い dry-run は通常作業の入口ではなく、調査用です。
Dev org から大きく retrieve した直後や、Scratch Org 初期反映用 manifest の範囲を見直す場合に使います。

広い dry-run で失敗した metadata は、Scratch Org の機能差、標準 namespace、組織固有値、更新不可コンポーネントなどに分けて扱います。
必要なものだけを Scratch Org の設定、作業対象 manifest、または個別 metadata に反映します。
