# Salesforce VS Code の LWC 補完設定と診断

Salesforce Extension Pack for Visual Studio Code は、LWC の入力補完やモジュール解決に使う `jsconfig.json` を生成します。このファイルに関する TypeScript の警告と、LWC Language Server の診断を切り分けるときの考え方をまとめます。

## `jsconfig.json` の役割

Salesforce DX project を開くと、LWC Language Server は package directory の LWC module root を検出し、`force-app/main/default/lwc/jsconfig.json` のような設定ファイルを生成または更新します。

主な設定は次のとおりです。

| 設定                     | 役割                                                            |
| ------------------------ | --------------------------------------------------------------- |
| `experimentalDecorators` | LWC で使う decorator の構文を認識する。                         |
| `paths`                  | `c/componentName` 形式の import を LWC module root に解決する。 |
| `include`                | LWC source と `.sfdx/typings/lwc` の型定義を補完対象にする。    |
| `typeAcquisition`        | Jest の型情報を test file で利用する。                          |

このファイルは LWC metadata ではなく、ローカルエディター向けの生成物です。Salesforce project の標準テンプレートでも Git 管理対象外とされ、`.forceignore` では deploy 対象外にします。

## TypeScript 6 の `baseUrl` 警告

TypeScript 6 では `baseUrl` が非推奨になり、TypeScript 7 では機能しなくなる予定です。一方、Salesforce 拡張機能が生成する設定には、LWC module の解決用として次の組み合わせが含まれる場合があります。

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "c/*": ["*"]
        }
    }
}
```

生成された `baseUrl` だけを削除しても、拡張機能の再初期化時に復元される可能性があります。Salesforce 拡張機能側の移行が完了するまで警告を抑える場合は、`compilerOptions` に次を追加します。

```json
"ignoreDeprecations": "6.0"
```

これは非推奨機能を新しい方式へ移行する設定ではなく、警告を一時的に抑える設定です。TypeScript または Salesforce 拡張機能を更新したときは、生成内容と module 解決を再確認します。

## 空メッセージの `LWC1702`

LWC Jest test の `import { createElement } from 'lwc';` などに、詳細のない `LWC1702:` が表示されることがあります。次の条件がそろう場合は、source code の構文エラーではなく、LWC Language Server の診断状態を疑います。

- 診断元が `lwc` で、エラーメッセージが空である。
- `lwc` module の hover や入力補完は機能している。
- CLI の lint と対象 Jest test が成功する。
- VS Code の window reload で一時的に消えるが、test file を開くと再表示される。

診断表示だけを根拠に test code や import を変更せず、CLI の結果と照合します。確認例は次のとおりです。

```bash
npm run lint
npm run test:unit -- -- --runTestsByPath \
    force-app/main/default/lwc/example/__tests__/example.test.js \
    --runInBand
./node_modules/.bin/tsc \
    --project force-app/main/default/lwc/jsconfig.json \
    --noEmit --pretty false
```

CLI でも失敗する場合は、最初の具体的なエラーメッセージ、module path、mock、Jest 設定を順に確認します。CLI が成功し、空の `LWC1702` だけが残る場合は、拡張機能または LWC Language Server の更新状況を確認します。

## 生成ファイルを確認するときの注意

`jsconfig.json` を VS Code で開いたまま外部処理が更新すると、editor に古い未保存内容が残ることがあります。disk 上の内容を確認してから、必要に応じて `File: Revert File` で editor を再読み込みします。古い buffer を保存して、拡張機能が生成した新しい内容を上書きしないようにします。

## 参考情報

- [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
- [Salesforce VS Code extension の jsconfig template](https://github.com/forcedotcom/salesforcedx-vscode/blob/47b6f7d4cce00fa1c51a45fd9d9f9b125d552e67/packages/salesforcedx-lightning-lsp-common/src/resources/sfdx/jsconfig-sfdx.ts)
- [Salesforce VS Code extension の jsconfig 生成処理](https://github.com/forcedotcom/salesforcedx-vscode/blob/47b6f7d4cce00fa1c51a45fd9d9f9b125d552e67/packages/salesforcedx-lightning-lsp-common/src/baseContext.ts#L349-L466)
- [Salesforce DX project template の `.gitignore`](https://github.com/forcedotcom/salesforcedx-templates/blob/3a059e11a15019aaab0427f05bf4eac71f06367e/src/templates/project/gitignore#L11-L12)
