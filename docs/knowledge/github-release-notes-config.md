# GitHubリリースノート設定

GitHub の `.github/release.yml` は、GitHub Release を作るときの自動生成リリースノートを整えるための設定です。

CI を動かしたり、npm package を公開したり、Salesforce metadata を deploy したりする設定ではありません。

## 何をするものか

GitHub Releaseでは、前回のリリースから今回のリリースまでにマージされたPRをもとにリリースノートを自動生成できます。

`.github/release.yml`があると、そのPRをラベルごとに分類して表示できます。

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

この場合、`enhancement`ラベルのPRは「機能追加」、`bug`ラベルのPRは「不具合修正」に入ります。

どのカテゴリにも当てはまらない Pull Request は、`*` を指定したカテゴリに入ります。

## 何が良くなるか

リリースノートが、単なるPRの時系列一覧ではなくなります。

変更内容を次のような観点で読みやすくできます。

- 機能追加
- 不具合修正
- ドキュメント
- テストや品質改善
- GitHub Actions や運用まわり

PRにラベルをきちんと付けておくほど、リリースノートもきれいに分類されます。

## ラベル運用との関係

`.github/release.yml`は、PRのラベルを見て分類します。

そのため、リリースノートをきれいに作るには、PR作成時やマージ前にラベルを整えておく必要があります。

逆に、ラベルが付いていない、または分類に使わないラベルだけが付いているPRは、期待したカテゴリに入りません。

## 注意点

`.github/release.yml`はリリースノートの見せ方を変えるだけです。

次のことはしません。

- release を自動作成する。
- tag を自動作成する。
- CI を実行する。
- package を publish する。
- Salesforce 組織へ deploy する。
- PRにラベルを自動付与する。

release 自体を作る操作は、GitHub の画面、GitHub CLI、または別の workflow で行います。

## 設定を見直すタイミング

次のような場合は、`.github/release.yml` を見直します。

- ラベルの種類や名前を変えた。
- リリースノートのカテゴリが実際の変更内容と合わなくなった。
- PR が多くなり、カテゴリを細かく分けたい。
- 逆にカテゴリが多すぎて読みにくくなった。

リリースノートの分類は、リポジトリのラベル設計と一緒に考えるのが自然です。
