# CI で Prettier を確認する意味

この文書は、`npm run prettier:verify` を GitHub Actions などの CI で実行すると何が起きるのかを整理します。

## Prettier とは

Prettier は、コードやメタデータ、Markdown などの書き方を機械的にそろえる formatter です。

たとえば、次のような差分を人が手で判断しなくてよいようにします。

- インデント幅
- 改行位置
- quote の種類
- 末尾カンマ
- Markdown table の幅

Prettier はコードの意味を確認するツールではありません。見た目と書式をそろえるためのツールです。

## `prettier --write` と `prettier --check`

Prettier には大きく 2 つの使い方があります。

| コマンド           | 何をするか         | ファイルを書き換えるか |
| ------------------ | ------------------ | ---------------------- |
| `prettier --write` | 整形して保存する   | 書き換える             |
| `prettier --check` | 整形済みか確認する | 書き換えない           |

このリポジトリでは、`package.json` の script で次のように使い分けます。

```sh
npm run prettier
npm run prettier:verify
```

`npm run prettier` は `--write` なので、対象ファイルを整形します。

`npm run prettier:verify` は `--check` なので、対象ファイルが整形済みか確認し、崩れていれば失敗します。

## pre-commitフックとの違い

pre-commitフックは、コミットするときにローカルで動きます。

このリポジトリでは、staged files に対して `prettier --write` が実行されます。つまり、コミットしようとしたファイルは、その場で自動整形されます。

ただし、pre-commitフックだけでは次のようなケースを完全には拾えません。

- フックが入っていない環境でコミットされた。
- `--no-verify`でフックをスキップした。
- GitHub 上で直接ファイルを編集した。
- 自動生成や外部ツールの差分が整形されていない。
- 過去の未整形ファイルが残っていた。

そこで CI でも `prettier:verify` を実行すると、リポジトリに入る変更が整形済みかをもう一段確認できます。

## CI で実行すると何が起きるか

CI に次のステップを追加します。

```yaml
- name: Check formatting
  run: npm run prettier:verify
```

PRや`main`へのプッシュのたびに、GitHub Actionsが整形確認を実行します。

整形済みなら通ります。

整形されていないファイルがある場合、CI は失敗します。CI はファイルを直しません。開発者がローカルで `npm run prettier` を実行し、整形差分をコミットします。

## 何が良くなるか

- PR で整形崩れを見落としにくくなる。
- レビューで書式の指摘を減らせる。
- ローカルフックに依存しすぎない。
- docs、Apex、metadata、LWC などを同じルールで確認できる。
- lint や test より前に、軽い確認として早く失敗させられる。

## 何は保証しないか

Prettier check は、次のことは保証しません。

- Apex が正しく動くこと。
- Salesforce 組織へ deploy できること。
- LWC のテストが通ること。
- セキュリティ上の問題がないこと。
- コード設計が良いこと。

あくまで「書式がそろっているか」を見る確認です。

## CI での位置づけ

CI では、`prettier:verify` は lint や test より前に置くのが分かりやすいです。

理由は、整形崩れは軽く早く検出できるからです。

```text
npm ci
npm audit --audit-level=high
npm run prettier:verify
npm run lint
npm run test:unit
```

この順番にすると、書式が崩れているだけの PR は早い段階で失敗します。

## 注意点

CI の `prettier:verify` は対象ファイル全体を確認します。

そのため、初めて導入するときに既存ファイルが未整形だと、今回の変更に関係ないファイルで失敗することがあります。導入前にローカルで `npm run prettier:verify` を実行し、既存差分がないことを確認します。

また、CIは自動修正しません。自動修正までCIに任せると、PRブランチへのプッシュ権限やbotコミットの扱いが必要になり、運用が複雑になります。まずは検査のみで十分です。
