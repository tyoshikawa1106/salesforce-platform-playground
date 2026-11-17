// 言語だけでは地域が決まらない場合の初期値を定義
const DEFAULT_LOCALES = Object.freeze({
    ja: 'ja_JP',
    en_US: 'en_US',
    de: 'de_DE',
    es: 'es_ES',
    fr: 'fr_FR',
    it: 'it_IT',
    sv: 'sv_SE',
    ko: 'ko_KR',
    da: 'da_DK',
    th: 'th_TH',
    fi: 'fi_FI',
    ru: 'ru_RU',
    no: 'no_NO'
});

// 並べ替えの比較ごとに優先順位表を作り直さず共有する
const LANGUAGE_PRIORITY = Object.freeze({ ja: 0, en_US: 1 });

// コードと表示名から選択肢を作り、日本語・英語を優先
export function createOptions(labels = {}, prioritizeLanguages = false) {
    // サーバーから受け取った候補を基本コンポーネント形式へ変換
    const options = Object.entries(labels).map(([value, label]) => ({ value, label }));
    // 言語の優先順以外は表示名で並べる
    return options.sort((left, right) => {
        // 地域候補には言語の優先順を適用しない
        const rankDifference = prioritizeLanguages
            ? (LANGUAGE_PRIORITY[left.value] ?? 2) - (LANGUAGE_PRIORITY[right.value] ?? 2)
            : 0;
        // 同じ順位では現在のブラウザーの照合順で表示
        return rankDifference || left.label.localeCompare(right.label);
    });
}

// 言語に対応する有効な地域だけを自動設定
export function selectDefaultLocale(language, localeOptions) {
    // 明示した対応または地域付き言語コードを使用
    const preferred = DEFAULT_LOCALES[language] ?? language;
    // 組織に存在する候補だけを設定
    if (localeOptions.some((option) => option.value === preferred)) {
        // 対応表または完全一致の地域を返却
        return preferred;
    }
    // 新しい言語に対して一意に決まる地域があるか確認
    const matches = localeOptions.filter((option) => option.value.startsWith(`${language}_`));
    // 複数地域がある場合は推測せず選択を求める
    return matches.length === 1 ? matches[0].value : '';
}

// 現在値が選択肢にない場合も実際の保存値を表示
export function getDisplayLabel(value, labels = {}) {
    // サーバーが返した対応表を直接参照し、継承プロパティは表示名として扱わない
    const label = Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : undefined;
    // 有効な表示名、保存値、未設定表示の順に採用
    return label ?? (value || '未設定');
}

// 画面の選択肢と保存要求の整合性を検証
export function createSaveRequest(language, locale, languages, locales) {
    // 有効な言語が選択されていなければ保存不可
    if (!languages.some((option) => option.value === language)) {
        // 項目を修正できる案内を返却
        return { errorMessage: '利用可能な言語を選択してください。' };
    }
    // 自動設定できなかった地域も明示選択を必須にする
    if (!locales.some((option) => option.value === locale)) {
        // 項目を修正できる案内を返却
        return { errorMessage: '利用可能な地域を選択してください。' };
    }
    // ユーザーIDを含めず許可した2項目だけを渡す
    return { errorMessage: '', parameters: { language, locale } };
}