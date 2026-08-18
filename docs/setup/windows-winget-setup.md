# Windows 開発環境のセットアップ

この文書では、Windows で Salesforce DX 開発に必要なツールを導入します。
wingetに現行パッケージがあるツールはwingetで管理し、ないツールは提供元の公式インストーラーを使用します。
Node.js / npm はプロジェクトごとに要求バージョンが変わりやすいため、Volta で管理します。

この文書の通常のコマンド例は、PowerShellとコマンドプロンプトのどちらでも実行できます。
PowerShell固有の操作が必要な復旧手順では、その箇所に実行環境を明記します。

## 管理対象ツール

このリポジトリで使う主なツールは次のとおりです。

| ツール           | 役割                                                                 | 管理方法                   |
| ---------------- | -------------------------------------------------------------------- | -------------------------- |
| Git              | ソースコードのバージョン管理                                         | winget                     |
| GitHub CLI       | GitHub 認証、Issue、Pull Request、CI 状態確認                        | winget                     |
| Salesforce CLI   | Salesforce 開発、組織操作、メタデータ操作                            | 公式EXE                    |
| Node.js / npm    | npm scripts、ESLint、SLDS Linter、Prettier、LWC Jest、開発依存の実行 | Volta                      |
| Java JDK         | Salesforce Code Analyzer の PMD / CPD / SFGE engine で利用           | winget                     |
| Python 3.10 以降 | Salesforce Code Analyzer の Flow engine で利用                       | winget                     |
| Heroku CLI       | Heroku アプリケーション管理                                          | 公式インストーラー（任意） |

## 1. winget の確認

winget が使えることを確認します。

```text
winget --version
```

wingetはWindows 11と現在サポートされているWindows 10の「アプリ インストーラー」に含まれます。
利用できない場合は、Microsoftの[wingetのインストール手順](https://learn.microsoft.com/windows/package-manager/winget/)に従って確認します。

パッケージを導入する前に、既定のwinget sourceで正確なPackage IDが見つかることを確認します。
`winget show`でパッケージが見つからない場合や、PublisherとInstaller URLが提供元の公式情報と一致しない場合はインストールを止めます。

```text
winget show --id Git.Git -e --source winget
```

## 2. 基本ツールのインストール

Git:

[Git公式Windowsインストール手順](https://git-scm.com/install/windows)で案内されているPackage IDを使用します。

```text
winget install --id Git.Git -e --source winget
```

GitHub CLI:

[GitHub CLI公式Windowsインストール手順](https://github.com/cli/cli/blob/trunk/docs/install_windows.md)で案内されているPackage IDを使用します。

```text
winget install --id GitHub.cli -e --source winget
```

GitHub にログインする場合:

```text
gh auth login
```

Salesforce CLI:

Salesforce CLIには、既定のwinget sourceで利用できる現行パッケージがありません。
Salesforceの[Salesforce CLIダウンロードページ](https://developer.salesforce.com/tools/salesforcecli/)から、Windows x64またはWindows ARM64のEXEを選択して実行します。
インストーラーが完了したら、新しいターミナルを開いて確認します。

```text
sf --version
```

## 3. Java JDK

Salesforce Code Analyzer の PMD / CPD / SFGE engine では Java が必要です。

この手順では Temurin 21 JDK を使います。
wingetのパッケージ情報で、Eclipse Adoptiumが公開するインストーラーを参照していることを確認してから導入します。
インストーラー自体の動作は、Eclipse Adoptiumの[Windows MSIインストール手順](https://adoptium.net/installation/windows/)を参照します。

```text
winget show --id EclipseAdoptium.Temurin.21.JDK -e --source winget
winget install --id EclipseAdoptium.Temurin.21.JDK -e --source winget
```

確認:

```text
java --version
where.exe java
```

## 4. Node.js / npm

このリポジトリの npm scripts と CI は Node.js 24 を前提にします。

Node.js は Salesforce CLI の付属物ではなく、開発環境の前提として明示的に管理します。
winget の `OpenJS.NodeJS` には統一せず、Node.js / npm は Volta で管理します。

Volta を winget でインストールします。
[Volta公式手順](https://docs.volta.sh/guide/getting-started)では、Windowsの推奨インストール方法としてwingetが案内されています。

```text
winget install --id Volta.Volta -e --source winget
```

ターミナルを開き直し、Volta が使えることを確認します。

```text
volta --version
where.exe volta
```

Node.js 24 をインストールします。

```text
volta install node@24
```

確認:

```text
where.exe node
node --version
where.exe npm
npm --version
volta list
```

`node --version` は `v24.x` であることを確認します。

## 5. Python 3.13

Salesforce Code Analyzer の Flow engine は Python 3.10 以降を必要とします。

### インストール

wingetのパッケージ情報で、Python Software Foundationが公開するインストーラーを参照していることを確認し、Python 3.13をユーザーscopeへ入れます。
インストーラーがPATHを設定するため、通常手順ではPATHを直接編集しません。
Python自体のWindowsでの動作とLauncherは、Pythonの[WindowsでPythonを使う](https://docs.python.org/3.13/using/windows.html)も参照します。

```text
winget show --id Python.Python.3.13 -e --source winget
winget install --id Python.Python.3.13 -e --scope user --source winget
```

インストール後にターミナルを開き直し、WindowsのPython Launcherと`python`コマンドを確認します。

```text
py -3.13 --version
python --version
```

`py -3.13`は成功するが`python`が見つからない場合や別バージョンを指す場合は、PATHを手動追加せず、Windowsの「インストールされているアプリ」からPythonを修復するか、wingetで再インストールします。
過去の操作後に複数のコマンドが見つからない場合は、追加変更を止めて[Windows PATHの確認と復旧](windows-path-recovery.md)を確認します。

## 6. Heroku CLI（任意）

このリポジトリでは Heroku CLI は不要です。Heroku アプリケーションを扱う場合だけインストールします。

wingetの`Heroku.HerokuCLI`は現行版ではないため使用しません。
Herokuの[Heroku CLI公式手順](https://devcenter.heroku.com/articles/heroku-cli)から、Windows用インストーラーを選択して実行します。

確認:

```text
heroku --version
```

Heroku にログインする場合:

```text
heroku login
```

## 7. Salesforce Code Analyzer plugin

Salesforce CLI に Code Analyzer plugin が入っていることを確認します。

```text
sf plugins --core
```

`code-analyzer` が表示されれば OK です。

入っていない場合:

```text
sf plugins install code-analyzer
sf code-analyzer rules
```

Code AnalyzerはJIT pluginのため、最初の`sf code-analyzer`コマンドで自動導入することもできます。前提と手動導入方法はSalesforceの[Code Analyzer公式手順](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/analyze.html)を参照します。

## 8. インストール確認

### winget パッケージ

winget で管理しているパッケージを確認します。

```text
winget list
```

このリポジトリ向けには、少なくとも次が含まれていれば十分です。

```text
Git
GitHub CLI
Temurin 21 JDK
Python 3.13
Volta
```

Salesforce CLIと任意のHeroku CLIはwinget管理ではないため、この一覧には含まれません。

### バージョン

各ツールのバージョンを確認します。

```text
git --version
gh --version
java --version
python --version
py -3.13 --version
sf --version
node --version
npm --version
volta --version
```

### コマンド参照先

コマンドの参照先を確認します。

```text
where.exe git
where.exe gh
where.exe java
where.exe python
where.exe sf
where.exe node
where.exe npm
where.exe volta
```

### Salesforce CLI plugin

Salesforce CLI の plugin を確認します。

```text
sf plugins --core
```

## 9. プロジェクト依存のセットアップ

[プロジェクトのセットアップ](project-setup.md)に従って、npm 依存の再現とローカルチェックを実行します。
`npm ci` は、監査済みの互換依存を含む `package-lock.json` の解決結果をそのまま再現します。

Python の初期化エラーが出る場合は、`python --version`、`py -3.13 --version`、`where.exe python` を確認します。PATHへ固定パスを追加せず、Pythonの修復または再インストールで直します。

## 10. 定期メンテナンス

winget で管理しているツールは、更新対象を確認してから個別に更新します。
更新コマンドの動作は、Microsoftの[winget upgrade公式手順](https://learn.microsoft.com/windows/package-manager/winget/upgrade)を参照します。

| コマンド                             | 役割                                     |
| ------------------------------------ | ---------------------------------------- |
| `winget upgrade`                     | 更新可能なパッケージを一覧表示する       |
| `winget upgrade --id <PackageId> -e` | 指定したパッケージを更新する             |
| `winget list`                        | インストール済みパッケージを一覧表示する |
| `winget source update`               | winget のソース情報を更新する            |

ソース情報を更新し、更新可能なパッケージを確認します。

```text
winget source update
winget upgrade
```

確認後、このリポジトリで使用するパッケージだけを個別に更新します。

```text
winget upgrade --id Git.Git -e --source winget
winget upgrade --id GitHub.cli -e --source winget
winget upgrade --id Volta.Volta -e --source winget
winget upgrade --id EclipseAdoptium.Temurin.21.JDK -e --source winget
winget upgrade --id Python.Python.3.13 -e --source winget
```

Salesforce CLIとHeroku CLIの更新は、それぞれの公式手順に従います。`winget upgrade --all`はこのリポジトリ以外のアプリケーションも更新するため、標準手順にはしません。

管理対象の確認:

```text
winget list
```
