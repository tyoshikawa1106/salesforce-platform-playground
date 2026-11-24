// 件数を日本語の区切りで表示する。
const COUNT_FORMAT = new Intl.NumberFormat('ja-JP');

// 出力範囲と確定した件数を確認文に反映する。
export function confirmationText(period, range, count) {
    // 月別・6ヶ月間の出力には絞り込み条件を含めない。
    if (period !== 'results') return range + 'の設定変更履歴をすべてCSV出力しますか？';
    // 絞り込み結果では未確定とゼロ件を区別する。
    return count === undefined ? range + 'の検索結果の件数を確認中です。' :
        range + 'の検索条件に一致する全' + COUNT_FORMAT.format(count) + '件をCSV出力しますか？';
}
