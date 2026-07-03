# プロジェクト

この手順では、開発ツールのインストール後に実施する、Salesforce DX プロジェクト側の準備を定義します。

## 前提

- Salesforce CLI が使えること
- Node.js 24 / npm が使えること
- Salesforce 開発組織へログインできること

## 初期セットアップ

npm 依存をインストールします。

```sh
npm ci
```

`npm ci` は、`package-lock.json` に固定された npm 依存を再現します。
Husky、lint-staged、Prettier、ESLint、LWC Jest など、コミット前チェックや LWC 開発に必要な依存もここで入ります。

`package-lock.json` は npm 依存の再現性を保つために管理対象とします。

このリポジトリの npm scripts と CI は Node.js 24 を前提にします。

日常的に使う確認コマンドと役割は [開発コマンド一覧](../development/development-commands.md) にまとめます。

## Prettier

Salesforce 開発では Apex、metadata、LWC を 4 spaces で扱います。

このプロジェクトの Prettier 設定は、Salesforce のサンプルギャラリーで使われている DreamHouse、E-Bikes、LWC Recipes、Apex Recipes の構成を参考にします。

他の Salesforce プロジェクトで開発を開始する場合は、最初に次のファイルを確認・更新します。

| ファイル                | 目的                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `.prettierrc`           | Salesforce 開発を 4 spaces で整形するための Prettier 設定                                   |
| `.prettierignore`       | static resources、ローカル生成物、接続情報などを整形対象から外す設定                        |
| `package.json`          | `prettier` / `prettier:verify` / `precommit` scripts、`lint-staged`、devDependencies の設定 |
| `package-lock.json`     | npm 依存の固定。`package.json` を変えた場合に更新される                                     |
| `docs/setup/project.md` | そのプロジェクトで採用した準備手順                                                          |

適用順:

1. `.prettierrc` に 4 spaces 前提の Prettier 設定を入れる。
2. `.prettierignore` で整形対象外を確認する。
3. `package.json` に scripts、`lint-staged`、必要な devDependencies を揃える。
4. `npm install` で `package-lock.json` を更新する。
5. `npm run prettier` を実行し、初回整形差分を確認する。
6. `npm run prettier:verify` を実行する。
7. Apex を含む場合は、必要に応じて `sf code-analyzer run` と Apex test を実行する。
8. このドキュメントと同じ粒度で、対象プロジェクトの setup docs に採用内容を残す。

別プロジェクトへ適用する場合は、このリポジトリの設定ファイルをコピーしてよいです。
ただし、ファイルごとに扱いを分けます。

| ファイル                | コピー方針                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `.prettierrc`           | ほぼそのままコピーしてよい                                                                                                |
| `.prettierignore`       | 基本部分はコピーしてよい。プロジェクト固有の生成物があれば追加する                                                        |
| `package.json`          | 丸ごと上書きしない。`prettier` / `prettier:verify` / `precommit` / `lint-staged` / devDependencies の必要部分だけ移植する |
| `package-lock.json`     | コピーしない。対象プロジェクトで `npm install` して生成・更新する                                                         |
| `docs/setup/project.md` | Prettier セクションをコピーし、対象プロジェクトの前提に合わせて調整する                                                   |

コピー後の確認:

```sh
npm install
npm run prettier
npm run prettier:verify
git diff
```

Apex があるプロジェクトでは、必要に応じて次も確認します。

```sh
sf code-analyzer run --target force-app
sf apex run test --test-level RunLocalTests --code-coverage --synchronous
```

- `.prettierrc` で `tabWidth: 4` を明示する。
- `singleQuote: true` と `trailingComma: none` を使う。
- `prettier-plugin-apex` と `@prettier/plugin-xml` を使う。
- `npm run prettier` は手動の整形コマンドとして用意する。
- `npm run prettier:verify` は整形確認用として使う。
- `lint-staged` では staged files に対して Prettier の自動 write を実行する。

`prettier --write` は対象ファイルを書き換えるため、Apex や Salesforce metadata を含む変更では実行後に `git diff` を確認します。
コミット時にも staged files が書き換わる可能性があるため、コミット後に `git show` や `git diff HEAD^ HEAD` で実際に入った差分を確認します。

### Prettier が動くタイミング

手動で整形する場合:

```sh
npm run prettier
```

手動で整形確認だけ行う場合:

```sh
npm run prettier:verify
```

コミット時は、`git add` された staged files だけに対して `lint-staged` が動きます。
次の拡張子の staged files がある場合、pre-commit hook で `prettier --write` が実行されます。

```text
cls, cmp, component, css, html, js, json, md, page, trigger, xml, yaml, yml
```

コミット時の流れ:

```text
git add
git commit
Husky pre-commit hook
npm run precommit
lint-staged
prettier --write
書き換えられた staged files を再 stage
commit
```

編集済みでも `git add` していないファイルは、commit 時の `lint-staged` 対象にはなりません。
`.prettierignore` に含まれるファイルやディレクトリも対象外です。

## Salesforce CLI

CLI の動作確認:

```sh
sf --version
```

Salesforce 開発組織へログインする場合:

```sh
sf org login web --set-default --alias <alias>
```

接続済みの Salesforce 組織に対する deploy、delete、retrieve、test などの操作は、実行前に対象と目的を確認します。
開発タスクで deploy や Apex test を行う場合は、現在接続されている組織だけを対象にし、明示依頼なしに target org を切り替えません。
