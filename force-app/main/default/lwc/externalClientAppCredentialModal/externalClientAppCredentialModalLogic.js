// 親が正規化した対象IDに15桁・18桁の入力を照合する
export function matchesApplicationId(value, expectedId) {
    // 前後の空白を除いて確認する
    const entered = (value || '').trim();
    // 正規化済みの対象以外を一致として扱わない
    if (!/^0xI[a-zA-Z0-9]{15}$/.test(expectedId || '')) return false;
    // 18桁はチェックサムを含めて完全一致を要求する
    return entered === expectedId || entered === expectedId.slice(0, 15);
}
