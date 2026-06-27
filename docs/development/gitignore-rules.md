# .gitignore 運用メモ

このリポジトリの `.gitignore` は、Salesforce 公式サンプルの `trailheadapps/dreamhouse-lwc` を基本形にし、リポジトリ固有のローカル生成物だけを追加します。

## 基本方針

- Salesforce CLI、LWC、Node、OS、エディタが生成するローカルファイルはコミットしない。
- 秘密情報や個人環境の値が入り得る `.env` 系ファイルはコミットしない。
- 共有価値がある設定例やテンプレートは ignore しない。
- 成果物になり得るファイル拡張子は、用途が決まるまで広く ignore しない。

## `.env` 系ファイル

| パターン       | 扱い                                        |
| -------------- | ------------------------------------------- |
| `.env`         | ignore する                                 |
| `.env.local`   | ignore する                                 |
| `.env.*.local` | ignore する                                 |
| `.env.example` | ignore しない。テンプレートとしてコミット可 |

`.env.*` をまとめて ignore すると `.env.example` まで隠れるため、このリポジトリでは local 系だけを対象にします。

## DreamHouse との差分

DreamHouse の `.gitignore` に加えて、このリポジトリでは次を ignore します。

- `.agents/`, `skills-lock.json`: agent / sf-skills のローカル生成物。
- `.pmdCache`: ApexPMD のキャッシュ。
- `export-out/*`: Salesforce CLI の export 結果。CSV / JSON などの生成物は Git 管理しない。`export-out/export-out-guide.md` だけは出力先フォルダ名を固定するため Git 管理する。
- `logs/apex/*`: Salesforce CLI で取得した Apex debug log のローカル出力。ログファイルは Git 管理しない。`logs/apex/apex-log-guide.md` だけは出力先フォルダ名を固定するため Git 管理する。
- `logs/code-analyzer/*`: Salesforce Code Analyzer のローカル解析出力。JSON / log / HTML など、解析結果として再生成できるファイルは Git 管理しない。`logs/code-analyzer/code-analyzer-guide.md` だけは出力先フォルダ名を固定するため Git 管理する。
- `**/__pycache__/`, `**/.venv/`, `**/venv/`: Python Salesforce Functions 用のローカル生成物。
- `.env.local`, `.env.*.local`: 個人ローカルの環境変数ファイル。
