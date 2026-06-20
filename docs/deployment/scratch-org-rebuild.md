# Scratch Org 再現

新しい Scratch Org でこのプロジェクトのメタデータを再現するときの手順です。

## 基本方針

- `config/project-scratch-def.json` は Scratch Org 作成用の設定として扱う。
- Dev 組織への deploy 先設定とは分けて考える。
- Scratch Org で再現できない前提が見つかった場合は、設定または docs に残す。
- 個人環境の alias や認証情報をコミットしない。
- Scratch Org は一時環境として扱い、確認が終わったら削除する。

## 前提

Scratch Org の作成には Dev Hub が必要です。

```sh
sf org list
```

Dev Hub が未設定の場合は、利用する Dev Hub を確認してからログインまたは指定します。
このリポジトリの通常開発で使う Dev 組織とは別の前提として扱います。

## 作成前の確認

作成前に次を確認します。

- `sfdx-project.json` の package directory と API version
- `config/project-scratch-def.json` の edition、features、settings
- Dev 組織との差分として明示すべき前提
- Scratch Org に投入する metadata が `force-app/main/default` に揃っているか
- 作成に使う alias と duration

## 作成

Scratch Org を作成します。

```sh
sf org create scratch --definition-file config/project-scratch-def.json --alias scratch-platform-playground --duration-days 7
```

alias は個人環境の値なので、必要に応じて各自のローカルで変えます。
Dev Hub を明示する必要がある場合は、確認済みの Dev Hub を `--target-dev-hub` で指定します。

```sh
sf org display --target-org scratch-platform-playground
```

## 反映

Scratch Org にメタデータを反映します。

```sh
sf project deploy start --source-dir force-app --target-org scratch-platform-playground
```

source tracking が使える Scratch Org でも、このリポジトリの通常開発では Dev 組織の前提と混同しないようにします。

## 確認

必要に応じて Apex テストを実行します。

```sh
sf apex run test --test-level RunLocalTests --result-format human --target-org scratch-platform-playground
```

組織をブラウザで確認する場合:

```sh
sf org open --target-org scratch-platform-playground
```

## 削除

確認が終わったら Scratch Org を削除します。

```sh
sf org delete scratch --target-org scratch-platform-playground
```

削除前に、必要な metadata や確認結果がリポジトリ側に反映されているか確認します。

## 作業報告

Scratch Org 再現を確認した場合は次を報告します。

- 作成に使った scratch definition
- Scratch Org の alias
- 実行した deploy / test
- 再現できなかった metadata や組織設定
- docs または metadata に反映すべき差分
