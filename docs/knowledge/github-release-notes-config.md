# GitHub Release notes 設定

GitHub の `.github/release.yml` は、GitHub Release を作るときの自動生成リリースノートを整えるための設定です。

CI を動かしたり、npm package を公開したり、Salesforce metadata を deploy したりする設定ではありません。

## 何をするものか

GitHub Release では、前回 release から今回 release までに merge された Pull Request をもとに release notes を自動生成できます。

`.github/release.yml` があると、その Pull Request を label ごとに分類して表示できます。

たとえば、次のようにカテゴリを分けられます。

```yaml
changelog:
    categories:
        - title: 機能追加
          labels:
              - enhancement
        - title: 不具合修正
          labels:
              - bug
        - title: その他
          labels:
              - '*'
```

この場合、`enhancement` label の Pull Request は「機能追加」、`bug` label の Pull Request は「不具合修正」に入ります。

どのカテゴリにも当てはまらない Pull Request は、`*` を指定したカテゴリに入ります。

## 何が良くなるか

release notes が、単なる Pull Request の時系列一覧ではなくなります。

変更内容を次のような観点で読みやすくできます。

- 機能追加
- 不具合修正
- ドキュメント
- テストや品質改善
- GitHub Actions や運用まわり

Pull Request に label をきちんと付けておくほど、release notes もきれいに分類されます。

## label 運用との関係

`.github/release.yml` は、Pull Request の label を見て分類します。

そのため、release notes をきれいに作るには、PR 作成時や merge 前に label を整えておく必要があります。

逆に、label が付いていない、または分類に使わない label だけが付いている Pull Request は、期待したカテゴリに入りません。

## 注意点

`.github/release.yml` は release notes の見せ方を変えるだけです。

次のことはしません。

- release を自動作成する。
- tag を自動作成する。
- CI を実行する。
- package を publish する。
- Salesforce 組織へ deploy する。
- Pull Request に label を自動付与する。

release 自体を作る操作は、GitHub の画面、GitHub CLI、または別の workflow で行います。

## 設定を見直すタイミング

次のような場合は、`.github/release.yml` を見直します。

- label の種類や名前を変えた。
- release notes のカテゴリが実際の変更内容と合わなくなった。
- PR が多くなり、カテゴリを細かく分けたい。
- 逆にカテゴリが多すぎて読みにくくなった。

release notes の分類は、リポジトリの label 設計と一緒に考えるのが自然です。
