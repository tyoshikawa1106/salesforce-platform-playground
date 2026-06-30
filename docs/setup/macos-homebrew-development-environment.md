# macOS 開発環境構築手順（Homebrew 版）

この手順では、macOS の開発ツールを Homebrew で管理します。
Node.js / npm はプロジェクトごとに要求バージョンが変わりやすいため、Volta で管理します。

## 管理対象ツール

このリポジトリで使う主なツールは次のとおりです。

| ツール           | 役割                                                       | 管理方法 |
| ---------------- | ---------------------------------------------------------- | -------- |
| Git              | ソースコードのバージョン管理                               | Homebrew |
| GitHub CLI       | GitHub 認証、Issue、Pull Request、CI 状態確認              | Homebrew |
| Salesforce CLI   | Salesforce 開発、組織操作、メタデータ操作                  | Homebrew |
| Node.js / npm    | npm scripts、ESLint、Prettier、LWC Jest、開発依存の実行    | Volta    |
| Java JDK         | Salesforce Code Analyzer の PMD / CPD / SFGE engine で利用 | Homebrew |
| Python 3.10 以降 | Salesforce Code Analyzer の Flow engine で利用             | Homebrew |
| Heroku CLI       | Heroku アプリケーション管理                                | 任意     |

## Homebrew のインストール

Homebrew が未インストールの場合は、公式インストールスクリプトを実行します。

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

インストール確認:

```sh
brew --version
```

## 基本ツールのインストール

Git:

```sh
brew install git
```

GitHub CLI:

```sh
brew install gh
```

GitHub にログインする場合:

```sh
gh auth login
```

Salesforce CLI:

```sh
brew install sf
```

## Java JDK

Salesforce Code Analyzer の PMD / CPD / SFGE engine では Java が必要です。

この手順では Homebrew の OpenJDK 25 を使います。

```sh
brew install openjdk@25
```

macOS の Java ランチャーから使えるように登録します。

`/opt/homebrew` を直接書くと Apple Silicon Mac 固定になるため、`brew --prefix` を使います。

```sh
sudo ln -sfn "$(brew --prefix openjdk@25)/libexec/openjdk.jdk" /Library/Java/JavaVirtualMachines/openjdk-25.jdk
```

必要に応じて、Homebrew の Java を PATH の前方に追加します。

```sh
echo 'export PATH="$(brew --prefix openjdk@25)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

確認:

```sh
java --version
/usr/libexec/java_home -V
```

## Node.js / npm

このリポジトリの npm scripts と CI は Node.js 26 を前提にします。

Node.js は Salesforce CLI の付属物ではなく、開発環境の前提として明示的に管理します。
Homebrew の `node` には統一せず、Node.js / npm は Volta で管理します。

Volta を Homebrew でインストールします。

```sh
brew install volta
```

Volta の shim を PATH の前方に追加します。

```sh
printf '\n# Volta for project-specific Node.js versions\nexport VOLTA_HOME="$HOME/.volta"\nexport PATH="$VOLTA_HOME/bin:$PATH"\n' >> ~/.zshrc
source ~/.zshrc
```

Node.js 26 をインストールします。

```sh
volta install node@26
```

確認:

```sh
which node
node --version
which npm
npm --version
volta list
```

`node --version` は `v26.x` であることを確認します。

## Python 3.13

Salesforce Code Analyzer の Flow engine は Python 3.10 以降を必要とします。

Homebrew で Python 3.13 を入れます。

```sh
brew install python@3.13
```

Homebrew の versioned Python は `python3.13` を提供します。

```sh
python3.13 --version
```

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
printf '\n# Homebrew Python 3.13 for Salesforce Code Analyzer Flow engine\nexport PATH="$(brew --prefix python@3.13)/libexec/bin:$PATH"\n' >> ~/.zshrc
source ~/.zshrc
```

確認:

```sh
which python3
python3 --version
```

`python3 --version` が `Python 3.10.x` 以上であれば、Code Analyzer の Flow engine も Python を検出できます。

## Heroku CLI（任意）

このリポジトリでは Heroku CLI は不要です。Heroku アプリケーションを扱う場合だけインストールします。

```sh
brew tap heroku/brew
brew install heroku
brew trust heroku/brew
```

Heroku にログインする場合:

```sh
heroku login
```

## Salesforce Code Analyzer plugin

Salesforce CLI に Code Analyzer plugin が入っていることを確認します。

```sh
sf plugins
```

`code-analyzer` が表示されれば OK です。

入っていない場合:

```sh
sf plugins install @salesforce/plugin-code-analyzer
```

## インストール確認

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

Salesforce CLI の plugin を確認します。

```sh
sf plugins
```

## プロジェクト依存のセットアップ

このリポジトリでは、`package-lock.json` に固定された依存を再現します。

```sh
npm ci
```

主要なローカルチェック:

```sh
npm run prettier:verify
npm run lint -- --no-error-on-unmatched-pattern
npm run test:unit -- -- --runInBand --passWithNoTests
npm audit --omit=dev
npm run code-analyzer:ci
```

`npm run code-analyzer:ci` が `Found 0 violations.` または実際の violation 一覧を出せば、Salesforce Code Analyzer は実行できています。

Python の初期化エラーが出る場合は、`python3 --version` と `which python3` を再確認します。

## 定期メンテナンス

Homebrew で管理しているツールは、定期的に更新と不要ファイルの削除を行います。

| コマンド          | 役割                                             |
| ----------------- | ------------------------------------------------ |
| `brew update`     | Homebrew とパッケージ情報を最新化する            |
| `brew upgrade`    | インストール済みパッケージを最新バージョンにする |
| `brew autoremove` | 不要になった依存パッケージを削除する             |
| `brew cleanup`    | 古いバージョンやキャッシュを削除する             |
| `brew outdated`   | 更新可能なパッケージを一覧表示する               |
| `brew leaves`     | トップレベルパッケージを表示する                 |
| `brew tap`        | 追加されている Tap を表示する                    |

更新:

```sh
brew update
brew upgrade
```

不要なファイルと依存関係の削除:

```sh
brew autoremove
brew cleanup
```

更新可能なパッケージ確認:

```sh
brew outdated
```

Homebrew 管理対象の確認:

```sh
brew leaves
```

Tap の確認:

```sh
brew tap
```
