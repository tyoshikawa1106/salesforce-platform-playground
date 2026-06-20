# ESLint の unmatched glob

ESLint では、指定した glob pattern に一致するファイルがない場合にエラーになることがあります。

たとえば Salesforce DX プロジェクトで Aura と LWC の JavaScript をまとめて確認するために、次のような npm script を置くことがあります。

```json
"lint": "eslint **/{aura,lwc}/**/*.js"
```

この指定は、実行環境や ESLint 側の解釈では次のような pattern として扱われます。

```text
**/aura/**/*.js
**/lwc/**/*.js
```

LWC は存在していても Aura の `.js` が存在しないプロジェクトでは、ESLint が `**/aura/**/*.js` を一致なしとして失敗することがあります。

```text
No files matching the pattern "**/aura/**/*.js" were found.
```

この場合、LWC の lint error ではなく、glob が現在のファイル構成と合っていないことが原因です。

## 回避方法

Aura と LWC の両方を対象にする意図を残すなら、`--no-error-on-unmatched-pattern` を付けます。

```json
"lint": "eslint \"**/{aura,lwc}/**/*.js\" --no-error-on-unmatched-pattern"
```

これにより、Aura が存在しない状態でも LWC の JavaScript は lint され、将来 Aura が追加された場合も同じ script で確認できます。

## 分けて書く場合

LWC を必須、Aura を存在すれば確認する、という意図を明確にしたい場合は script を分けます。

```json
"lint": "npm run lint:lwc && npm run lint:aura",
"lint:lwc": "eslint \"**/lwc/**/*.js\"",
"lint:aura": "eslint \"**/aura/**/*.js\" --no-error-on-unmatched-pattern"
```

この書き方は意図が読みやすい一方で、npm script が増えます。

## LWC だけに絞る場合

Aura を扱わないプロジェクトなら、LWC だけを対象にできます。

```json
"lint": "eslint \"**/lwc/**/*.js\""
```

ただし Salesforce DX プロジェクトでは、あとから Aura metadata が追加される可能性もあるため、プロジェクトの方針に合わせて選びます。
