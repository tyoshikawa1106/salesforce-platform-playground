# logs ガイド

`logs/` は、Salesforce CLI で取得した Apex debug log やローカル解析結果の出力先です。

`sf apex get log` や解析コマンドで生成したファイルは Git 管理しません。ガイドだけを Git 管理し、ローカル出力先フォルダ名を `logs/` に固定します。

## Apex debug log

Apex debug log の出力先は `logs/apex/` です。詳細は `logs/apex/apex-log-guide.md` を参照します。

## Code Analyzer

Salesforce Code Analyzer の出力先は `logs/code-analyzer/` です。詳細は `logs/code-analyzer/code-analyzer-guide.md` を参照します。
