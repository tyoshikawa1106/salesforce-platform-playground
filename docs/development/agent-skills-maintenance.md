# Salesforce Agent Skills のメンテナンス

## Skills CLI のバージョン確認と更新

`npx` が実行する Skills CLI のバージョンを確認します。

```sh
npx skills --version
```

`Need to install` と表示された場合は、提示されたバージョンを確認します。`y` を入力すると、その版を取得して実行します。

## Salesforce スキルの更新

取得元にあるスキルをすべて取り込みます。導入済みのスキルは更新され、新しいスキルは追加されます。

```sh
npx skills add https://github.com/forcedotcom/sf-skills/tree/main/skills --skill '*'
```

インストール先の選択が表示されたら、プロジェクトの共有ディレクトリ `.agents/skills/` を選びます。

取得元で削除されたスキルや改名前の旧スキルは手元に残ります。削除も反映する場合は、次を実行し、表示された削除対象を確認して承認します。

```sh
npx skills update --project
```
