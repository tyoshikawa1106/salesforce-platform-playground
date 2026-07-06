# メタデータ管理ルール

Salesforce メタデータを取得・参照・編集・反映するときの実務ルールです。

## 基本方針

- `manifest/package.xml` と `manifest/package-*.xml` は、AI エージェントが Salesforce 組織から retrieve して参照・編集するための作業対象 catalog として扱う。
- package 系 manifest は Git 管理対象一覧ではない。Git 管理対象は `.gitignore`、deploy scope は deploy 用 manifest または `--metadata` で別に判断する。
- 組織から retrieve したメタデータは、コミット前または反映前に差分を確認する。
- 広い manifest で retrieve した結果を、そのまま Git 管理の基準や deploy scope として扱わない。
- 組織固有の値、認証情報、個人環境の値はメタデータに入れない。
- コードや既存メタデータから確認できない業務仕様を推測で固定しない。

## 取得と追加

- retrieve 対象の指定がない場合は、原則として `manifest/package.xml` で広く取得する。
- 対象 metadata type や名前が指定されている場合は、`manifest/package-*.xml`、作業対象 manifest、または `--metadata` で必要な範囲に絞って取得する。
- package 系 manifest に含まれない metadata が必要な場合は、`--metadata`、一時 manifest、または org から生成した manifest で追加取得する。
- retrieve 前に、対象 Salesforce 組織の alias、取得方法、既存ファイルへの上書き影響、権限系メタデータへの影響を確認する。
- retrieve は確認済みの alias を `--target-org <alias>` で明示して実行する。
- 自動生成に見える差分や権限系の広い差分は、必要性を確認してから残す。
- Git 管理対象外の metadata でも、タスクに必要な場合は retrieve して参照してよい。編集や反映は依頼範囲に含まれる場合だけ行う。
- Git 管理対象外の metadata を扱う場合は、対象 metadata、対象 org、反映方法、Git に残さない理由を作業報告に残す。
- Git 管理対象にする metadata type は、原則として type 単位で扱う。個別ファイルを部分選別する場合は、Git の再現性が崩れない理由を確認する。
- 組織依存、権限、認証、通知、ユーザー参照、機密情報を含み得る metadata は、Git 管理や反映対象にする前に必要性を確認する。

取得後は `git status --short`、`git diff --stat`、必要に応じて `git diff` で差分を確認します。
広い manifest で retrieve すると、Salesforce CLI の結果表では `Changed` が多数表示されることがあります。
コミット判断では CLI の表示だけでなく Git の差分を基準にします。
ignore されている metadata は Git 差分に出ないことがあるため、必要に応じて対象ファイルや retrieve 結果を個別に確認します。

## 確認と報告

作業報告には次を含めます。

- 変更したメタデータ種別とファイル
- Git 管理対象外 metadata を扱った場合は、対象 metadata、対象 org、反映方法、Git に残さない理由
- 実行した validate / deploy / test
- 対象 Salesforce 組織の alias
- 実行しなかった確認と、その理由
