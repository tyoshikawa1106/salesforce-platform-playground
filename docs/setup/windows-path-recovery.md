# Windows PATHの確認と復旧

過去のセットアップ手順にあった `setx PATH` の実行後、Git、Node.js、Salesforce CLIなどのコマンドが見つからなくなった場合に、PATHの状態を確認して復旧するための手順です。

`setx` は長い値を1,024文字で切り詰め、その値を永続化することがあります。詳細は [setxの公式ドキュメント](https://learn.microsoft.com/windows-server/administration/windows-commands/setx) を参照してください。

## 最初に行うこと

- `setx PATH` やPATH全体を書き戻す別のコマンドを実行しません。
- 問題が起きる前から開いていたPowerShellまたはコマンドプロンプトが残っている場合は閉じません。そのプロセスには変更前のPATHが残っている可能性があります。
- 現在のユーザーPATHとMachine PATHを確認するまでは、環境変数画面で項目を削除しません。
- 組織管理端末では、永続設定を変更する前に管理者へ確認します。

## 現在の状態を確認する

新しいPowerShellで、永続化されているユーザーPATHとMachine PATHを別々に表示します。このコマンドは値を変更しません。

```powershell
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")

"User PATH"
$userPath -split ";" | Where-Object { $_ }

"Machine PATH"
$machinePath -split ";" | Where-Object { $_ }
```

PowerShellの `$env:Path` は、そのプロセスが起動した時点のユーザーPATHとMachine PATHなどを組み合わせた値です。`$env:Path`全体をユーザーPATHへコピーしません。

## 変更前から開いていたPowerShellがある場合

問題が起きる前から開いていたPowerShellで、変更前のプロセスPATHにだけ残っている候補を表示します。このコマンドも値を変更しません。

```powershell
$oldProcessPaths = @($env:Path -split ";" | Where-Object { $_ })
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$currentUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$machinePaths = @($machinePath -split ";" | Where-Object { $_ })
$currentUserPaths = @($currentUserPath -split ";" | Where-Object { $_ })

$recoveryCandidates = $oldProcessPaths | Where-Object {
    $_ -notin $machinePaths -and $_ -notin $currentUserPaths
}
$recoveryCandidates
```

表示された値は自動的に書き戻さず、次を確認します。

1. ディレクトリが現在も存在する。
2. 利用しているアプリケーションまたは開発ツールのディレクトリである。
3. Machine PATHに同じ役割の項目がない。

確認できた項目だけを、Windowsの「環境変数を編集」からユーザー環境変数の `Path` へ1件ずつ追加します。変更前のプロセスPATH全体は追加しません。

## 変更前から開いていたコマンドプロンプトだけがある場合

問題が起きる前から開いていたコマンドプロンプトで、次のコマンドを実行します。起動したPowerShellには、そのコマンドプロンプトが保持している変更前のプロセスPATHが引き継がれます。

```bat
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile
```

起動したPowerShellを閉じずに、[変更前から開いていたPowerShellがある場合](#変更前から開いていたpowershellがある場合)の候補表示コマンドを実行します。候補を確認するまでは、元のコマンドプロンプトも閉じません。

## 変更前のPowerShellまたはコマンドプロンプトが残っていない場合

元のユーザーPATHを自動的に推測して書き戻すことはできません。次の順序で復旧します。

1. Windowsの「環境変数を編集」で、現在のユーザーPATHとMachine PATHを確認します。
2. 使用できなくなったコマンドを特定し、そのツールの公式インストーラーに修復または再インストール手順がある場合は、その手順でPATH登録を復元します。
3. 組織管理端末では、管理者が管理している標準PATHと比較します。
4. 変更前の復元ポイントがあり、個別修復では戻せない場合だけ、影響を受けるプログラムを確認してSystem Restoreを検討します。

System Restoreはレジストリ設定とインストール済みプログラムにも影響します。実行前に重要データをバックアップし、Microsoftの [System Restore](https://support.microsoft.com/en-us/windows/experience/backup-recovery/system-restore) と [Windowsの回復オプション](https://support.microsoft.com/en-us/windows/experience/backup-recovery/recovery-options-in-windows) で影響を確認します。

## Pythonだけが見つからない場合

既存PATHの復旧後、Code Analyzer用Pythonだけが不足している場合は、固定パスを手動追加しません。
[Windows開発環境のセットアップ](windows-winget-setup.md#5-python-313)に従い、`py -3.13 --version`と`python --version`を確認してからインストール済みPythonの修復またはwingetでの再インストールを行います。

## 復旧後の確認

新しいPowerShellを開き、実際に使用しているツールだけを確認します。

```powershell
where.exe git
where.exe node
where.exe npm
where.exe sf
where.exe python
```

インストールしていないツールが見つからないことは異常ではありません。各コマンドが意図したディレクトリを指し、必要な開発コマンドが再び動作することを確認します。

## 参照

- [PowerShellの環境変数](https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_environment_variables)
- [Environment.GetEnvironmentVariable](https://learn.microsoft.com/dotnet/api/system.environment.getenvironmentvariable)
- [setx](https://learn.microsoft.com/windows-server/administration/windows-commands/setx)
- [System Restore](https://support.microsoft.com/en-us/windows/experience/backup-recovery/system-restore)
- [Windowsの回復オプション](https://support.microsoft.com/en-us/windows/experience/backup-recovery/recovery-options-in-windows)
