# Scratch Org 再現

新しい Scratch Org でこのプロジェクトのメタデータを再現するときの手順です。

## 基本方針

- `config/project-scratch-def.json` は Scratch Org 作成用の設定として扱う。
- Dev 組織への deploy 先設定とは分けて考える。
- Scratch Org で再現できない前提が見つかった場合は、設定または docs に残す。
- 個人環境の alias や認証情報をコミットしない。

## 作成前の確認

作成前に次を確認します。

- `sfdx-project.json` の package directory と API version
- `config/project-scratch-def.json` の edition、features、settings
- Dev 組織との差分として明示すべき前提
- Scratch Org に投入する metadata が `force-app/main/default` に揃っているか

## 作成

Scratch Org を作成します。

```sh
sf org create scratch --definition-file config/project-scratch-def.json --alias scratch --set-default
```

alias は個人環境の値なので、必要に応じて各自のローカルで変えます。

## 反映

Scratch Org にメタデータを反映します。

```sh
sf project deploy start --source-dir force-app
```

source tracking が使える Scratch Org でも、このリポジトリの通常開発では Dev 組織の前提と混同しないようにします。

## 確認

必要に応じて Apex テストを実行します。

```sh
sf apex run test --test-level RunLocalTests --result-format human
```

## 作業報告

Scratch Org 再現を確認した場合は次を報告します。

- 作成に使った scratch definition
- 実行した deploy / test
- 再現できなかった metadata や組織設定
- docs または metadata に反映すべき差分
