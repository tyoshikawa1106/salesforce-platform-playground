# インストール (Windows / winget ベース)

この手順では、Windows で Salesforce DX 開発に必要なツール一式を winget ベースで導入します。
Node.js / npm はプロジェクトごとに要求バージョンが変わりやすいため、Volta で管理します。

コマンドは PowerShell で実行します。

## 管理対象ツール

このリポジトリで使う主なツールは次のとおりです。

| ツール           | 役割                                                       | 管理方法 |
| ---------------- | ---------------------------------------------------------- | -------- |
| Git              | ソースコードのバージョン管理                               | winget   |
| GitHub CLI       | GitHub 認証、Issue、Pull Request、CI 状態確認              | winget   |
| Salesforce CLI   | Salesforce 開発、組織操作、メタデータ操作                  | winget   |
| Node.js / npm    | npm scripts、ESLint、Prettier、LWC Jest、開発依存の実行    | Volta    |
| Java JDK         | Salesforce Code Analyzer の PMD / CPD / SFGE engine で利用 | winget   |
| Python 3.10 以降 | Salesforce Code Analyzer の Flow engine で利用             | winget   |
| Heroku CLI       | Heroku アプリケーション管理                                | 任意     |

## winget の確認

winget が使えることを確認します。

```powershell
winget --version
```

winget が使えない場合は、Microsoft Store の「アプリ インストーラー」を更新します。

## 基本ツールのインストール

Git:

```powershell
winget install --id Git.Git -e
```

GitHub CLI:

```powershell
winget install --id GitHub.cli -e
```

GitHub にログインする場合:

```powershell
gh auth login
```

Salesforce CLI:

```powershell
winget install --id Salesforce.CLI -e
```

## Java JDK

Salesforce Code Analyzer の PMD / CPD / SFGE engine では Java が必要です。

この手順では Temurin 21 JDK を使います。

```powershell
winget install --id EclipseAdoptium.Temurin.21.JDK -e
```

確認:

```powershell
java --version
where.exe java
```

## Node.js / npm

このリポジトリの npm scripts と CI は Node.js 24 を前提にします。

Node.js は Salesforce CLI の付属物ではなく、開発環境の前提として明示的に管理します。
winget の `OpenJS.NodeJS` には統一せず、Node.js / npm は Volta で管理します。

Volta を winget でインストールします。

```powershell
winget install --id Volta.Volta -e
```

PowerShell を開き直し、Volta が使えることを確認します。

```powershell
volta --version
where.exe volta
```

Node.js 24 をインストールします。

```powershell
volta install node@24
```

確認:

```powershell
where.exe node
node --version
where.exe npm
npm --version
volta list
```

`node --version` は `v24.x` であることを確認します。

## Python 3.13

Salesforce Code Analyzer の Flow engine は Python 3.10 以降を必要とします。

winget で Python 3.13 を入れます。

```powershell
winget install --id Python.Python.3.13 -e
```

Windows では Python Launcher の `py` でバージョンを指定できます。

```powershell
py -3.13 --version
```

ただし、Code Analyzer は環境から `python3` または `python` を探します。

Python 3.13 を入れていても、`python` や `python3` が別バージョンを指す場合があります。

```powershell
python --version
python3 --version
py -3.13 --version
```

この状態で `python` / `python3` が Python 3.10 以降を指していない場合、Code Analyzer の Flow engine が次のようなエラーで失敗します。

```text
Could not locate a Python v3.10.0+ install using any of the following:
["python3","python"].
```

ユーザーインストールの Python 3.13 を PATH の前方に追加する例:

```powershell
$pythonDir = "$env:LOCALAPPDATA\Programs\Python\Python313"
$pythonScripts = "$pythonDir\Scripts"
setx PATH "$pythonDir;$pythonScripts;$env:PATH"
```

PowerShell を開き直して確認します。

```powershell
where.exe python
python --version
where.exe python3
python3 --version
```

`python` または `python3` が Python 3.10 以降であれば、Code Analyzer の Flow engine も Python を検出できます。

## Heroku CLI（任意）

このリポジトリでは Heroku CLI は不要です。Heroku アプリケーションを扱う場合だけインストールします。

```powershell
winget install --id Heroku.HerokuCLI -e
```

Heroku にログインする場合:

```powershell
heroku login
```

## Salesforce Code Analyzer plugin

Salesforce CLI に Code Analyzer plugin が入っていることを確認します。

```powershell
sf plugins
```

`code-analyzer` が表示されれば OK です。

入っていない場合:

```powershell
sf plugins install @salesforce/plugin-code-analyzer
```

## インストール確認

winget で管理しているパッケージを確認します。

```powershell
winget list
```

このリポジトリ向けには、少なくとも次が含まれていれば十分です。

```text
Git
GitHub CLI
Salesforce CLI
Temurin 21 JDK
Python 3.13
Volta
```

Heroku CLI を任意で入れている場合は、Heroku CLI も表示されます。

各ツールのバージョンを確認します。

```powershell
git --version
gh --version
java --version
python --version
python3 --version
py -3.13 --version
sf --version
node --version
npm --version
volta --version
```

コマンドの参照先を確認します。

```powershell
where.exe git
where.exe gh
where.exe java
where.exe python
where.exe python3
where.exe sf
where.exe node
where.exe npm
where.exe volta
```

Salesforce CLI の plugin を確認します。

```powershell
sf plugins
```

## プロジェクト依存のセットアップ

このリポジトリでは、`package-lock.json` に固定された依存を再現します。

```powershell
npm ci
```

主要なローカルチェック:

```powershell
npm run prettier:verify
npm run lint -- --no-error-on-unmatched-pattern
npm run test:unit -- -- --runInBand --passWithNoTests
npm audit --omit=dev
npm run code-analyzer:ci
```

`npm run code-analyzer:ci` が `Found 0 violations.` または実際の violation 一覧を出せば、Salesforce Code Analyzer は実行できています。

Python の初期化エラーが出る場合は、`python --version`、`python3 --version`、`py -3.13 --version`、`where.exe python` を再確認します。

## 定期メンテナンス

winget で管理しているツールは、定期的に更新します。

| コマンド               | 役割                                     |
| ---------------------- | ---------------------------------------- |
| `winget upgrade`       | 更新可能なパッケージを一覧表示する       |
| `winget upgrade --all` | インストール済みパッケージを更新する     |
| `winget list`          | インストール済みパッケージを一覧表示する |
| `winget source update` | winget のソース情報を更新する            |

更新可能なパッケージ確認:

```powershell
winget upgrade
```

更新:

```powershell
winget source update
winget upgrade --all
```

管理対象の確認:

```powershell
winget list
```
