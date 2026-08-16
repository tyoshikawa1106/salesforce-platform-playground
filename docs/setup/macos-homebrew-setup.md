# macOS 開発環境のセットアップ

この手順では、Apple Silicon Macで Salesforce DX 開発に必要なツール一式を、標準の `/opt/homebrew` にインストールしたHomebrewを使って導入します。
Node.js / npm はプロジェクトごとに要求バージョンが変わりやすいため、Volta で管理します。

## 管理対象ツール

このリポジトリで使う主なツールは次のとおりです。

| ツール           | 役割                                                                 | 管理方法 |
| ---------------- | -------------------------------------------------------------------- | -------- |
| Git              | ソースコードのバージョン管理                                         | Homebrew |
| GitHub CLI       | GitHub 認証、Issue、Pull Request、CI 状態確認                        | Homebrew |
| Salesforce CLI   | Salesforce 開発、組織操作、メタデータ操作                            | Homebrew |
| Node.js / npm    | npm scripts、ESLint、SLDS Linter、Prettier、LWC Jest、開発依存の実行 | Volta    |
| Java JDK         | Salesforce Code Analyzer の PMD / CPD / SFGE engine で利用           | Homebrew |
| Python 3.10 以降 | Salesforce Code Analyzer の Flow engine で利用                       | Homebrew |
| Heroku CLI       | Heroku アプリケーション管理                                          | 任意     |

## 1. Homebrew のインストール

Homebrew が未インストールの場合は、[Homebrew公式サイト](https://brew.sh/)のインストールスクリプトを実行します。

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Homebrewを現在のshellと以後のzsh login shellで使えるようにします。

```sh
eval "$(/opt/homebrew/bin/brew shellenv)"
brew --version

homebrewShellenvLine='eval "$(/opt/homebrew/bin/brew shellenv)"'
grep -Fqx "$homebrewShellenvLine" ~/.zprofile 2>/dev/null || printf '\n%s\n' "$homebrewShellenvLine" >> ~/.zprofile
```

同じ行がある場合は追記しません。この設定は現在のユーザーのzsh login shellへ永続的に適用されます。設定を戻す場合は、`.zprofile`からこの `eval` 行だけを削除し、新しいshellを開きます。

## 2. 基本ツールのインストール

Git:

[Homebrewのgit formula](https://formulae.brew.sh/formula/git)を使用します。

```sh
brew install git
```

GitHub CLI:

[Homebrewのgh formula](https://formulae.brew.sh/formula/gh)を使用します。

```sh
brew install gh
```

GitHub にログインする場合:

```sh
gh auth login
```

Salesforce CLI:

[Homebrewのsf formula](https://formulae.brew.sh/formula/sf)を使用します。

```sh
brew install sf
```

## 3. Java JDK

Salesforce Code Analyzer の PMD / CPD / SFGE engine では Java が必要です。

この手順では Homebrew の OpenJDK 25 を使います。
[Homebrewのopenjdk@25 formula](https://formulae.brew.sh/formula/openjdk@25)を使用します。

```sh
brew install openjdk@25
```

macOS の Java ランチャーから使えるように登録します。

この手順の対象であるApple Silicon MacのHomebrew標準配置を使用します。

既存の登録先を強制置換せず、未登録の場合だけsymlinkを作成します。

```sh
javaTarget="/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk"
javaLink="/Library/Java/JavaVirtualMachines/openjdk-25.jdk"

if [ -e "$javaLink" ] || [ -L "$javaLink" ]; then
    ls -ld "$javaLink"
else
    sudo ln -s "$javaTarget" "$javaLink"
fi
```

既存の登録先が表示された場合は、自動で置き換えず、期待するJDKを指しているか確認します。新しく作成した登録を戻す場合も、対象がこの手順で作成したsymlinkであることを確認してから、そのsymlinkだけを削除します。

必要に応じて、Homebrew の Java を PATH の前方に追加します。

```sh
javaPathLine='export PATH="/opt/homebrew/opt/openjdk@25/bin:$PATH"'
grep -Fqx "$javaPathLine" ~/.zprofile 2>/dev/null || printf '\n%s\n' "$javaPathLine" >> ~/.zprofile
export PATH="/opt/homebrew/opt/openjdk@25/bin:$PATH"
```

同じ行がある場合は追記しません。この設定は現在のユーザーのzsh login shellへ永続的に適用されます。設定を戻す場合は、`.zprofile`からこの `export PATH` 行だけを削除し、新しいshellを開きます。

確認:

```sh
java --version
/usr/libexec/java_home -V
```

## 4. Node.js / npm

このリポジトリの npm scripts と CI は Node.js 24 を前提にします。

Node.js は Salesforce CLI の付属物ではなく、開発環境の前提として明示的に管理します。
Homebrew の `node` には統一せず、Node.js / npm は Volta で管理します。

Volta を Homebrew でインストールします。
[Homebrewのvolta formula](https://formulae.brew.sh/formula/volta)と[Volta公式手順](https://docs.volta.sh/guide/getting-started)を参照します。

```sh
brew install volta
```

Volta の shim を PATH の前方に追加します。

```sh
grep -Fqx 'export VOLTA_HOME="$HOME/.volta"' ~/.zprofile 2>/dev/null || printf '\nexport VOLTA_HOME="$HOME/.volta"\n' >> ~/.zprofile
grep -Fqx 'export PATH="$VOLTA_HOME/bin:$PATH"' ~/.zprofile 2>/dev/null || printf 'export PATH="$VOLTA_HOME/bin:$PATH"\n' >> ~/.zprofile
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"
```

同じ行がある場合は追記しません。この設定は現在のユーザーのzsh login shellへ永続的に適用されます。設定を戻す場合は、`.zprofile`から上記2行だけを削除し、新しいshellを開きます。

Node.js 24 をインストールします。

```sh
volta install node@24
```

確認:

```sh
which node
node --version
which npm
npm --version
volta list
```

`node --version` は `v24.x` であることを確認します。

## 5. Python 3.13

Salesforce Code Analyzer の Flow engine は Python 3.10 以降を必要とします。

### インストール

Homebrew で Python 3.13 を入れます。
[Homebrewのpython@3.13 formula](https://formulae.brew.sh/formula/python@3.13)を使用します。

```sh
brew install python@3.13
```

Homebrew の versioned Python は `python3.13` を提供します。

```sh
python3.13 --version
```

### PATH 設定

ただし、Code Analyzer は環境から `python3` または `python` を探します。

macOS では、Homebrew の Python 3.13 が入っていても、`python3` が macOS 標準の古い Python を指すことがあります。

```sh
python3 --version
# Python 3.9.6

python3.13 --version
# Python 3.13.x
```

この状態では、Code Analyzer の Flow engine が次のようなエラーで失敗します。

```text
Could not locate a Python v3.10.0+ install using any of the following:
["python3","python"].
```

Homebrew Python 3.13 の `python3` / `python` は `libexec/bin` にあります。

```text
/opt/homebrew/opt/python@3.13/libexec/bin/python3
/opt/homebrew/opt/python@3.13/libexec/bin/python
```

zsh で Homebrew Python 3.13 を優先します。

```sh
pythonPathLine='export PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"'
grep -Fqx "$pythonPathLine" ~/.zprofile 2>/dev/null || printf '\n%s\n' "$pythonPathLine" >> ~/.zprofile
export PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"
```

同じ行がある場合は追記しません。この設定は現在のユーザーのzsh login shellへ永続的に適用されます。設定を戻す場合は、`.zprofile`からこの `export PATH` 行だけを削除し、新しいshellを開きます。

以前の手順で同じ `export` 行を `.zshrc` に追加している場合は、新しいlogin shellで各ツールの確認が完了してから、該当する行だけを `.zshrc` から削除します。

### 確認

確認:

```sh
which python3
python3 --version
```

`python3 --version` が `Python 3.10.x` 以上であれば、Code Analyzer の Flow engine も Python を検出できます。

## 6. Heroku CLI（任意）

このリポジトリでは Heroku CLI は不要です。Heroku アプリケーションを扱う場合だけインストールします。
[Heroku CLI公式手順](https://devcenter.heroku.com/articles/heroku-cli)で案内されているHomebrew formulaを使用します。

```sh
brew install heroku/brew/heroku
```

formulaを完全修飾名で指定し、`heroku/brew` tap全体への信頼は追加しません。

Heroku にログインする場合:

```sh
heroku login
```

## 7. Salesforce Code Analyzer plugin

Salesforce CLI に Code Analyzer plugin が入っていることを確認します。

```sh
sf plugins --core
```

`code-analyzer` が表示されれば OK です。

入っていない場合:

```sh
sf plugins install code-analyzer
sf code-analyzer rules
```

Code AnalyzerはJIT pluginのため、最初の`sf code-analyzer`コマンドで自動導入することもできます。前提と手動導入方法はSalesforceの[Code Analyzer公式手順](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/analyze.html)を参照します。

## 8. インストール確認

### Homebrew パッケージ

Homebrew で直接管理しているトップレベルパッケージを確認します。

```sh
brew leaves
```

このリポジトリ向けには、少なくとも次が含まれていれば十分です。

```text
gh
git
openjdk@25
python@3.13
sf
volta
```

Heroku CLI を任意で入れている場合は、次も表示されます。

```text
heroku/brew/heroku
```

### バージョン

各ツールのバージョンを確認します。

```sh
git --version
gh --version
java --version
python3 --version
python3.13 --version
sf --version
node --version
npm --version
volta --version
```

### コマンド参照先

コマンドの参照先を確認します。

```sh
which git
which gh
which java
which python3
which python3.13
which sf
which node
which npm
which volta
```

### Salesforce CLI plugin

Salesforce CLI の plugin を確認します。

```sh
sf plugins --core
```

## 9. プロジェクト依存のセットアップ

[プロジェクトのセットアップ](project-setup.md)に従って、npm 依存の再現とローカルチェックを実行します。
`npm ci` は、監査済みの互換依存を含む `package-lock.json` の解決結果をそのまま再現します。

Python の初期化エラーが出る場合は、`python3 --version` と `which python3` を再確認します。

## 10. 定期メンテナンス

Homebrew で管理しているツールは、更新対象と削除対象を確認してから変更します。
各コマンドの影響と`--dry-run`は、Homebrewの[公式マニュアル](https://docs.brew.sh/Manpage)を参照します。

| コマンド                    | 役割                                       |
| --------------------------- | ------------------------------------------ |
| `brew update`               | Homebrew とパッケージ情報を最新化する      |
| `brew upgrade <formula>`    | 指定したパッケージを最新バージョンにする   |
| `brew autoremove --dry-run` | 削除対象になる依存パッケージを確認する     |
| `brew cleanup --dry-run`    | 削除対象になる古いバージョンなどを確認する |
| `brew outdated`             | 更新可能なパッケージを一覧表示する         |
| `brew leaves`               | トップレベルパッケージを表示する           |
| `brew tap`                  | 追加されている Tap を表示する              |

更新対象の確認:

```sh
brew update
brew outdated
```

このリポジトリで使用するパッケージだけを更新する例:

```sh
brew upgrade git gh sf openjdk@25 python@3.13 volta
```

Heroku CLIを導入している場合は、必要に応じて個別に更新します。

```sh
brew upgrade heroku/brew/heroku
```

削除対象の確認:

```sh
brew autoremove --dry-run
brew cleanup --dry-run
```

表示された対象を確認した場合だけ、`--dry-run`を外して実行します。引数なしの`brew upgrade`はHomebrew管理対象全体を更新するため、標準手順にはしません。

Homebrew 管理対象の確認:

```sh
brew leaves
```

Tap の確認:

```sh
brew tap
```
