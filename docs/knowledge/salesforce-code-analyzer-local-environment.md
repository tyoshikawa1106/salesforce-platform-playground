# Salesforce Code Analyzer のローカル実行環境

Salesforce Code Analyzer は、Salesforce CLI plugin として動作する静的解析ツールです。

複数の engine をまとめて実行するため、Salesforce CLI だけでなく、解析対象に応じて Node.js、Java、Python も必要になります。

## 必要なツール

代表的なローカル実行環境は次の構成です。

| 用途                                  | ツール           |
| ------------------------------------- | ---------------- |
| Salesforce CLI / Code Analyzer plugin | `sf`             |
| npm script / ESLint / RetireJS        | Node.js / npm    |
| PMD / CPD / SFGE                      | Java JDK         |
| Flow engine                           | Python 3.10 以降 |
| GitHub 連携や PR 確認                 | `gh`             |

## macOS のセットアップ例

Homebrew で基本ツールを入れる例:

```sh
brew install sf gh git openjdk@25 python@3.13
```

Node.js はプロジェクトの要求バージョンに合わせます。たとえば Volta を使う場合:

```sh
brew install volta
volta install node@24
```

Homebrew の Java を優先する必要がある場合:

```sh
echo 'export PATH="/opt/homebrew/opt/openjdk@25/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Homebrew の Python 3.13 を `python3` として使うため、`libexec/bin` を PATH に追加します。

```sh
printf '\n# Homebrew Python 3.13 for Salesforce Code Analyzer Flow engine\nexport PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"\n' >> ~/.zshrc
source ~/.zshrc
```

## Windows のセットアップ例

PowerShell で winget を使う例:

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id Salesforce.CLI -e
winget install --id Python.Python.3.13 -e
winget install --id EclipseAdoptium.Temurin.21.JDK -e
```

Node.js はプロジェクトの要求バージョンに合わせます。たとえば Volta を使う場合:

```powershell
winget install --id Volta.Volta -e
volta install node@24
```

Windows で Python Launcher を使う場合は、Python 3.13 が入っているか確認します。

```powershell
py -3.13 --version
python --version
python3 --version
```

`python3` または `python` が Python 3.10 以降を指していない場合は、Windows の「環境変数」または `setx PATH` で Python 3.13 のインストール先を PATH の前方に追加します。

ユーザーごとの代表例:

```powershell
$pythonDir = "$env:LOCALAPPDATA\Programs\Python\Python313"
$pythonScripts = "$pythonDir\Scripts"
setx PATH "$pythonDir;$pythonScripts;$env:PATH"
```

設定後は PowerShell を開き直して確認します。

```powershell
python --version
python3 --version
```

## Salesforce CLI plugin

Code Analyzer plugin が入っていることを確認します。

```sh
sf plugins
```

`code-analyzer` が表示されれば OK です。

入っていない場合:

```sh
sf plugins install @salesforce/plugin-code-analyzer
```

## バージョン確認

ローカル環境を確認します。

macOS / Linux:

```sh
node -v
npm -v
java -version
python3 --version
sf --version
sf plugins
```

Windows PowerShell:

```powershell
node -v
npm -v
java -version
python --version
python3 --version
sf --version
sf plugins
```

Code Analyzer の `flow` engine を使う場合、`python3 --version` は `Python 3.10.x` 以上である必要があります。

## macOS: Homebrew Python の注意点

macOS では、Homebrew で `python@3.13` を入れていても、`python3` が macOS 標準の古い Python を指すことがあります。

例:

```sh
python3 --version
# Python 3.9.6

python3.13 --version
# Python 3.13.x
```

この状態では、Code Analyzer の `flow` engine が `python3` を探したときに Python 3.10 以降を見つけられません。

```text
Could not locate a Python v3.10.0+ install using any of the following:
["python3","python"].
```

Homebrew の versioned Python には、バージョンなしの `python3` / `python` が `libexec/bin` に用意されています。

```text
/opt/homebrew/opt/python@3.13/libexec/bin/python3
/opt/homebrew/opt/python@3.13/libexec/bin/python
```

zsh で Homebrew Python を優先する例:

```sh
printf '\n# Homebrew Python 3.13 for Salesforce Code Analyzer Flow engine\nexport PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"\n' >> ~/.zshrc
source ~/.zshrc
```

確認:

```sh
which python3
python3 --version
```

`/opt/homebrew/opt/python@3.13/libexec/bin/python3` と `Python 3.13.x` が表示されれば、Code Analyzer の `flow` engine も Python 3.13 を使えます。

## Code Analyzer の実行確認

設定ファイルを確認します。

macOS / Linux:

```sh
sf code-analyzer config
```

Windows PowerShell:

```powershell
sf code-analyzer config
```

実際に解析します。

macOS / Linux:

```sh
sf code-analyzer run --rule-selector Recommended --target force-app --output-file logs/code-analyzer/local.json
```

Windows PowerShell:

```powershell
sf code-analyzer run --rule-selector Recommended --target force-app --output-file logs/code-analyzer/local.json
```

npm script があるプロジェクトでは、プロジェクト側の script を使います。

macOS / Linux:

```sh
npm run code-analyzer:ci
```

Windows PowerShell:

```powershell
npm run code-analyzer:ci
```

`Found 0 violations.` または実際の violation 一覧が出れば、Code Analyzer は実行できています。

## Python を repo 設定に固定しない判断

`code-analyzer.yml` には `engines.flow.python_command` を指定できます。

ただし、repo にローカル PC 固有の絶対パスを固定すると、CI や他メンバーの環境で壊れることがあります。

```yaml
engines:
    flow:
        python_command: /opt/homebrew/opt/python@3.13/libexec/bin/python3
```

このような設定は個人環境に強く依存します。

通常は、repo 設定ではなくローカルの PATH を整えて、`python3` が Python 3.10 以降を指す状態にする方が移植性を保ちやすいです。
