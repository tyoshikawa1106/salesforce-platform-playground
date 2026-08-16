# Salesforce Code Analyzer のローカル実行環境

Salesforce Code Analyzer は、Salesforce CLI plugin として動作する静的解析ツールです。
複数のengineをまとめて実行するため、解析対象に応じてSalesforce CLI以外の実行環境も必要です。

OS別のインストール手順は、次のsetup文書を正とします。この文書にはインストールコマンドを重複して掲載しません。

- [macOS開発環境のセットアップ](../setup/macos-homebrew-setup.md)
- [Windows開発環境のセットアップ](../setup/windows-winget-setup.md)

## 必要なツール

| 用途                                  | ツール        | Code Analyzerの前提      |
| ------------------------------------- | ------------- | ------------------------ |
| Salesforce CLI / Code Analyzer plugin | `sf`          | 必須                     |
| npm script / ESLint / RetireJS        | Node.js / npm | リポジトリではNode.js 24 |
| PMD / CPD / SFGE                      | Java JDK      | JDK 11以降               |
| Flow engine                           | Python        | Python 3.10以降          |
| GitHub連携やPR確認                    | `gh`          | リポジトリ運用で使用     |

Code Analyzerの現行要件とインストール方法は、Salesforceの[Code Analyzer公式手順](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/analyze.html)を確認します。

## Code Analyzer plugin

Code AnalyzerはJIT pluginのため、`sf code-analyzer rules`などを初めて実行したときに自動導入できます。
手動で導入する場合は、公式のplugin名を使用します。

```sh
sf plugins install code-analyzer
```

導入状態と利用できるルールを確認します。

```sh
sf plugins --core
sf code-analyzer rules
```

## Javaの確認

macOSとWindowsのどちらでも、Javaのバージョンを確認します。

```sh
java --version
```

JDK 11以降が表示されれば、PMD、CPD、SFGEの前提を満たします。
コマンドが見つからない場合や古いJavaを参照している場合は、OS別setup文書のJava手順を確認します。

## Pythonの確認

### macOS

```sh
which python3
python3 --version
```

`python3`がPython 3.10以降を指していることを確認します。
Homebrew PythonのPATH設定と戻し方は、macOSのsetup文書を確認します。

### Windows

```text
py -3.13 --version
where.exe python
python --version
```

`py -3.13`と`python`がPython 3.10以降を示すことを確認します。
Windowsでは`python3`コマンドを必須にしません。

`py -3.13`は成功するが`python`が見つからない場合や別バージョンを指す場合は、PATHへ固定パスを追加せず、インストール済みPythonの修復またはwingetでの再インストールを行います。
複数のコマンドが同時に見つからない場合は、[Windows PATHの確認と復旧](../setup/windows-path-recovery.md)を確認します。

## Code Analyzerの実行確認

設定を確認します。

```sh
sf code-analyzer config
```

リポジトリを直接解析します。

```sh
sf code-analyzer run --rule-selector Recommended --target force-app --output-file logs/code-analyzer/local.json
```

npm scriptでCI相当の解析を実行します。

```sh
npm run code-analyzer:ci
```

`Found 0 violations.` または実際のviolation一覧が出れば、Code Analyzerを実行できています。

## Pythonをrepo設定へ固定しない判断

`code-analyzer.yml`にはFlow engineが利用するPythonコマンドを指定できます。
ただし、ローカルPC固有の絶対パスをrepoへ固定すると、CIや別OSで動かなくなります。

通常はOS別setup文書に従って実行環境を整え、repo設定には個人環境の絶対パスを保存しません。
