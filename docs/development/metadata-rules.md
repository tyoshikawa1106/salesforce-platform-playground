# メタデータ管理ルール

Salesforce メタデータを取得・参照・編集・反映するときの実務ルールです。

## 基本方針

- `manifest/retrieve-all.xml` は、Salesforce 組織から取得対象とする全メタデータ型の確認用 catalog として扱う。
- `manifest/retrieve-profile.xml` は、スクリプトでProfileと関連メタデータを同時に取得する最初の retrieve scope として扱う。
- `manifest/retrieve-application.xml` は、スクリプトでアプリケーション実装、自動化、権限、外部連携を取得する2番目の retrieve scope として扱う。
- `manifest/retrieve-organization.xml` は、スクリプトで組織設定、セキュリティ、コンテンツ、サイトを取得する3番目の retrieve scope として扱う。
- `manifest/retrieve-translations.xml` は、`Translations` とその内容を構成する関連メタデータを同時に取得する最後の retrieve scope として扱う。
- `manifest/package.xml` は、Apex、Aura、LWC、静的リソース、Flowを手動で取得する作業用 manifest として扱う。
- retrieve / package manifest は Git 管理対象一覧ではない。Git 管理対象は `.gitignore`、deploy scope は deploy 用 manifest または `--metadata` で別に判断する。
- 組織から retrieve したメタデータは、コミット前または反映前に差分を確認する。
- 広い manifest で retrieve した結果を、そのまま Git 管理の基準や deploy scope として扱わない。
- 組織固有の値、認証情報、個人環境の値はメタデータに入れない。
- コードや既存メタデータから確認できない業務仕様を推測で固定しない。

## 取得対象

- retrieve 対象の指定がない場合は、`npm run sf:retrieve:all`を使い、VS Codeで現在接続している組織から4つのretrieve用manifestを順に取得する。
- 途中から再実行する場合は `--from <stage>`、1つのscopeだけを実行する場合は `--only <stage>` を指定する。stageは`profile`、`application`、`organization`、`translations`のいずれかとする。
- `Translations` は関連メタデータと別に取得すると内容が欠落するため、`retrieve-translations.xml` を最後に実行して完全な翻訳ファイルで更新する。
- 対象 metadata type や名前が指定されている場合は、`manifest/package.xml`、作業対象 manifest、または `--metadata` で必要な範囲に絞って取得する。
- 既存 manifest に含まれない metadata が必要な場合は、`--metadata`、一時 manifest、または org から生成した manifest で追加取得する。
- retrieve 前に、対象 Salesforce 組織の alias、取得方法、既存ファイルへの上書き影響、権限系メタデータへの影響を確認する。
- retrieve は確認済みの alias を `--target-org <alias>` で明示して実行する。

## Git 管理対象

- 自動生成に見える差分や権限系の広い差分は、必要性を確認してから残す。
- Git 管理対象外の metadata でも、タスクに必要な場合は retrieve して参照してよい。編集や反映は依頼範囲に含まれる場合だけ行う。
- Git 管理対象外の metadata を扱う場合は、対象 metadata、対象 org、反映方法、Git に残さない理由を作業報告に残す。
- Git 管理対象にする metadata type は、原則として type 単位で扱う。個別ファイルを部分選別する場合は、Git の再現性が崩れない理由を確認する。
- 組織依存、権限、認証、通知、ユーザー参照、機密情報を含み得る metadata は、Git 管理や反映対象にする前に必要性を確認する。

## 取得後確認

1. `git status --short` と `git diff --stat` で差分の範囲を確認する。
2. 必要に応じて `git diff` で内容を確認する。
3. ignore されている metadata は Git 差分に出ないことがあるため、必要に応じて対象ファイルや retrieve 結果を個別に確認する。

広い manifest で retrieve すると、Salesforce CLI の結果表では `Changed` が多数表示されることがあります。コミット判断では、CLI の表示だけでなく Git の差分を基準にします。

### deploy と retrieve の往復で発生する差分

Metadata API は、deploy した XML を常に同じ表現で返すとは限りません。retrieve 後は、次のような意味を変えない差分が発生することがあります。

- 同じ要素が複数ある metadata の並び替え
- deploy 時に省略した既定値の明示
- ファイル末尾の改行の削除
- API version の更新で追加された設定項目の明示

たとえば標準オブジェクトの `actionOverrides` は、Metadata API が端末種別ごとの要素を再配置し、省略されていた `skipRecordTypeSelect` の既定値 `false` を補って返すことがあります。これは画面設定の変更ではなく、Salesforce 側のシリアライズ結果による差分です。

往復差分を確認するときは、要素の順序だけでなく、識別子と値の組み合わせを比較します。既定値の補完や順序変更だけであれば正規化差分として扱い、設定値、参照先、対象 metadata が変わっている場合は実際の組織差分として扱います。

## 作業報告

作業報告には次を含めます。

- 変更したメタデータ種別とファイル
- Git 管理対象外 metadata を扱った場合は、対象 metadata、対象 org、反映方法、Git に残さない理由
- 実行した validate / deploy / test
- 対象 Salesforce 組織の alias
- 実行しなかった確認と、その理由
