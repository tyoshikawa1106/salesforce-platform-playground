# scripts ガイド

`scripts/` には、リポジトリで管理する補助スクリプトとクエリファイルを置きます。

- `scripts/setup/`: 初期 org セットアップ用の Node 実行入口と plan。
- `scripts/apex/`: 用途別に整理した anonymous Apex スクリプト。
- `scripts/soql/`: セットアップ後の確認やオブジェクト別確認に使う SOQL ファイル。
- `scripts/deployment/`: デプロイや org 再構築の補助スクリプト。

生成された export ファイルは `scripts/` に置きません。Salesforce CLI のローカル export 出力は `export-out/` に書き出します。

標準オブジェクトの初期データセットアップと export 例は [test-data-import.md](../docs/development/test-data-import.md) を参照してください。
