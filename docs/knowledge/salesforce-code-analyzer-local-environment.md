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

この例は、Apple Silicon Macと、標準の `/opt/homebrew` にインストールしたHomebrewを対象にします。

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
javaPathLine='export PATH="/opt/homebrew/opt/openjdk@25/bin:$PATH"'
grep -Fqx "$javaPathLine" ~/.zprofile 2>/dev/null || printf '\n%s\n' "$javaPathLine" >> ~/.zprofile
export PATH="/opt/homebrew/opt/openjdk@25/bin:$PATH"
```

同じ行がある場合は追記しません。この設定は現在のユーザーのzsh login shellへ永続的に適用されます。設定を戻す場合は、`.zprofile`からこの `export PATH` 行だけを削除します。

Homebrew の Python 3.13 を `python3` として使うため、`libexec/bin` を PATH に追加します。

```sh
pythonPathLine='export PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"'
grep -Fqx "$pythonPathLine" ~/.zprofile 2>/dev/null || printf '\n%s\n' "$pythonPathLine" >> ~/.zprofile
export PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"
```

同じ行がある場合は追記しません。この設定は現在のユーザーのzsh login shellへ永続的に適用されます。設定を戻す場合は、`.zprofile`からこの `export PATH` 行だけを削除します。

## Windows のセットアップ例

### 基本ツール

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

### Python PATH

Windows で Python Launcher を使う場合は、Python 3.13 が入っているか確認します。

```powershell
py -3.13 --version
python --version
python3 --version
```

`python3` または `python` が Python 3.10 以降を指していない場合は、Windows の「環境変数」で、Python 3.13 のインストール先をユーザー PATH の前方に追加します。

`setx PATH` は使用しません。既存の PATH が長い場合に値を切り詰め、その状態で永続化する可能性があるためです。詳細は [setx の公式ドキュメント](https://learn.microsoft.com/windows-server/administration/windows-commands/setx) を参照してください。

過去の手順で `setx PATH` を実行した後にコマンドが見つからなくなった場合は、PATHを追加変更せず、[Windows PATHの確認と復旧](../setup/windows-path-recovery.md)を先に確認します。

1. スタートメニューで「環境変数を編集」を開きます。
2. ユーザー環境変数の `Path` を選択して「編集」を開きます。
3. 次の2項目を追加し、Pythonの他の項目より上へ移動します。
    - `%LOCALAPPDATA%\Programs\Python\Python313`
    - `%LOCALAPPDATA%\Programs\Python\Python313\Scripts`
4. PowerShellを開き直して、設定を反映します。

永続設定を変更する前に、現在のPowerShellだけで動作確認する場合:

```powershell
$pythonDir = "$env:LOCALAPPDATA\Programs\Python\Python313"
$pythonScripts = "$pythonDir\Scripts"
$env:Path = "$pythonDir;$pythonScripts;$env:Path"
python --version
python3 --version
```

このPowerShell例は現在のプロセスだけに適用され、ユーザーPATHやMachine PATHを永続的に変更しません。

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
pythonPathLine='export PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"'
grep -Fqx "$pythonPathLine" ~/.zprofile 2>/dev/null || printf '\n%s\n' "$pythonPathLine" >> ~/.zprofile
export PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"
```

同じ行がある場合は追記しません。この設定は現在のユーザーのzsh login shellへ永続的に適用されます。設定を戻す場合は、`.zprofile`からこの `export PATH` 行だけを削除します。

確認:

```sh
which python3
python3 --version
```

`/opt/homebrew/opt/python@3.13/libexec/bin/python3` と `Python 3.13.x` が表示されれば、Code Analyzer の `flow` engine も Python 3.13 を使えます。

## Code Analyzer の実行確認

### 設定確認

設定ファイルを確認します。

macOS / Linux:

```sh
sf code-analyzer config
```

Windows PowerShell:

```powershell
sf code-analyzer config
```

### 直接実行

実際に解析します。

macOS / Linux:

```sh
sf code-analyzer run --rule-selector Recommended --target force-app --output-file logs/code-analyzer/local.json
```

Windows PowerShell:

```powershell
sf code-analyzer run --rule-selector Recommended --target force-app --output-file logs/code-analyzer/local.json
```

### npm script

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

通常は、repo 設定ではなくローカルの PATH を整えて、`python3` が Python 3.10 以降を指す状態にする方が環境差分を抑えやすいです。
