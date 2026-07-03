# LWC Jest とアクセシビリティテスト

この文書は、LWC Jest と `@sa11y/jest` を使ったアクセシビリティ確認の考え方とセットアップ方法を整理します。

## LWC Jest とは

LWC Jest は、Lightning Web Components を Salesforce 組織へ deploy せずにローカルでテストする仕組みです。

このリポジトリでは、`@salesforce/sfdx-lwc-jest` と npm scripts はすでに用意されています。

```sh
npm run test:unit
npm run test:unit:watch
npm run test:unit:debug
npm run test:unit:coverage
```

LWC Jest では、たとえば次のようなことを確認します。

- コンポーネントが期待した DOM を描画する。
- ボタンや input のイベントで状態が変わる。
- Apex や wire adapter の mock 結果を表示できる。
- navigation、toast、message service などのイベントを発火できる。
- エラー状態や空状態を表示できる。

## アクセシビリティテストとは

アクセシビリティテストは、UI がスクリーンリーダーやキーボード操作などに配慮できているかを確認するテストです。

Jest の単体テストでは、実際のブラウザ画面ではなく JSDOM 上の DOM を対象にします。そのため、すべてのアクセシビリティ問題を検出できるわけではありません。

それでも、次のような問題を早めに見つける助けになります。

- ボタンやリンクに識別できるテキストがない。
- 入力項目と label の関係が不十分。
- aria 属性の使い方が不正。
- DOM 構造として明らかなアクセシビリティ違反がある。

## `@sa11y/jest` とは

`@sa11y/jest` は Salesforce の `sa11y` プロジェクトが提供する Jest 向けアクセシビリティ matcher です。

`sa11y` は Salesforce 社が GitHub の `salesforce/sa11y` で公開している OSS のアクセシビリティ自動テストライブラリ群です。
ただし、Salesforce 組織へ接続したり、Salesforce メタデータを操作したりするツールではありません。
Salesforce チームで使われる前提の文脈はありますが、Salesforce 専用ではなく、axe-core で確認できる UI のアクセシビリティテストに使えます。

内部では axe-core ベースのチェックを使い、Jest test で DOM に対して `toBeAccessible()` のような assertion を書けるようにします。

## セットアップ

このリポジトリでは、`@sa11y/jest` と `jest-sa11y-setup.js` を導入済みです。
次の手順は、別プロジェクトや再セットアップ時の参考です。

`@sa11y/jest` を devDependency に追加します。

```sh
npm install --save-dev @sa11y/jest
```

Jest setup file を追加します。

```js
// jest-sa11y-setup.js
const { setup } = require('@sa11y/jest');

setup();
```

`jest.config.js` の `setupFilesAfterEnv` に setup file を追加します。

```js
const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

const setupFilesAfterEnv = jestConfig.setupFilesAfterEnv || [];
setupFilesAfterEnv.push('<rootDir>/jest-sa11y-setup.js');

module.exports = {
    ...jestConfig,
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
    setupFilesAfterEnv
};
```

これで、LWC Jest test から `toBeAccessible()` を使えるようになります。

## テストでの使い方

LWC を DOM に追加した後、対象の DOM を確認します。

```js
import { createElement } from 'lwc';
import MyComponent from 'c/myComponent';

describe('c-my-component', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('is accessible', async () => {
        const element = createElement('c-my-component', {
            is: MyComponent
        });

        document.body.appendChild(element);

        await expect(element).toBeAccessible();
    });
});
```

`toBeAccessible()` は非同期で実行します。`await` を付けずに呼ぶと、問題があっても正しく検出できないことがあります。

## automatic checks

`@sa11y/jest` には、各 test の後に自動でアクセシビリティ確認を走らせる仕組みもあります。

ただし、最初から automatic checks を有効にすると、通常の test failure とアクセシビリティ failure の関係が分かりにくくなることがあります。また、test の最後の DOM だけを見るため、途中状態の DOM は見落とす可能性があります。

このリポジトリでは、最初は automatic checks ではなく、重要な LWC test に明示的な `toBeAccessible()` assertion を書く方針が分かりやすいです。

## 注意点

Jest のアクセシビリティテストは万能ではありません。

- JSDOM 上で動くため、実ブラウザの見た目までは確認できない。
- color contrast のような視覚的な確認は苦手。
- audio / video など、JSDOM で十分に表現できない要素は限界がある。
- DOM を render してから確認する必要がある。
- fake timers を使う test では timeout に注意する。

実画面の確認や色のコントラストまで見る場合は、ブラウザベースの E2E / integration test で補完します。

## このリポジトリでの使いどころ

このリポジトリでは、LWC を追加するときに次をセットで考えます。

- LWC 本体
- LWC Jest test
- 必要な lightning / Apex / wire mock
- `@sa11y/jest` によるアクセシビリティ assertion

`@sa11y/jest` は、LWC test 基盤の一部として導入します。設定だけ先に置くより、最初の LWC test と一緒に使い方を示す方が運用しやすいです。

## 参考リンク

- [salesforce/sfdx-lwc-jest](https://github.com/salesforce/sfdx-lwc-jest)
- [salesforce/sa11y](https://github.com/salesforce/sa11y)
- [`@sa11y/jest` README](https://github.com/salesforce/sa11y/blob/master/packages/jest/README.md)
