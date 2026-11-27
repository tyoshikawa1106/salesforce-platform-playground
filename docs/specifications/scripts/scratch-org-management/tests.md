# Scratch Org管理スクリプトのテストコードと確認内容

[機能仕様に戻る](index.md)

## 確認する振る舞い

`scripts/scratch-org/test/*.node.js`で、alias、help、例外、step順序、失敗時停止、Salesforce CLI引数、設定参照、反映権限の範囲、権限準備からmanifest反映までの順序と各段階の失敗時停止、再構築manifestとGit管理sourceの整合を確認します。

```sh
node --test scripts/scratch-org/test/*.node.js
```

## テストファイルと代表的なケース

| ファイル                                                                                          | 確認内容                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [command.node.js](../../../../scripts/scratch-org/test/command.node.js)                           | 引数なしの場合は既定aliasで処理を実行する。--aliasで指定したaliasを実処理へ渡す。                                                            |
| [context.node.js](../../../../scripts/scratch-org/test/context.node.js)                           | リポジトリルートとScratch Org設定の参照先を解決できる。反映実行者の権限セットはポリシー反映に必要な権限だけを含む。                          |
| [external-client-apps.node.js](../../../../scripts/scratch-org/test/external-client-apps.node.js) | Scratch Orgでない対象には変換・反映・資格情報登録を実行しない。全Client Credentials Flowを管理者へ置換し、ファイル名やアプリ名を固定しない。 |
| [manifest.node.js](../../../../scripts/scratch-org/test/manifest.node.js)                         | 再構築manifestの全metadata typeに検証方針がありmemberが固定されている。CustomApplicationのユーザー作成sourceが再構築manifestと一致する。     |
| [setup.node.js](../../../../scripts/scratch-org/test/setup.node.js)                               | 作成結果のusernameで後続のScratch Org準備手順を順番に実行する。準備手順が失敗した場合は後続処理を実行しない。                                |
| [steps.node.js](../../../../scripts/scratch-org/test/steps.node.js)                               | Scratch Orgを設定ファイルの内容で作成する。Scratch Orgの実行者に反映権限を用意してからmanifestをNoTestRunで反映する。                        |
