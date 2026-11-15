import { createOptions, selectDefaultLocale, getDisplayLabel, createSaveRequest } from '../userLocaleSettingsLogic';

const languages = createOptions({ fr: 'フランス語', en_US: '英語', ja: '日本語' }, true);
const locales = createOptions({ ja_JP: '日本', en_US: '米国', en_GB: '英国', fr_FR: 'フランス' });

describe('userLocaleSettingsLogic', () => {
    it('prioritizes Japanese and English without changing the source', () => {
        const source = { fr: 'French', ja: 'Japanese', en_US: 'English', de: 'German' };
        expect(createOptions(source, true).map((option) => option.value)).toEqual(['ja', 'en_US', 'fr', 'de']);
        expect(Object.keys(source)).toEqual(['fr', 'ja', 'en_US', 'de']);
        expect(createOptions()).toEqual([]);
    });

    it.each([
        ['ja', 'ja_JP'], ['en_US', 'en_US'], ['fr', 'fr_FR'],
        ['de', 'de_DE'], ['es', 'es_ES'], ['it', 'it_IT'], ['sv', 'sv_SE'],
        ['ko', 'ko_KR'], ['da', 'da_DK'], ['th', 'th_TH'], ['fi', 'fi_FI'],
        ['ru', 'ru_RU'], ['no', 'no_NO'], ['zh_CN', 'zh_CN'],
        ['zh_TW', 'zh_TW'], ['pt_BR', 'pt_BR'], ['nl_NL', 'nl_NL'], ['es_MX', 'es_MX']
    ])('selects a valid default for %s', (language, locale) => {
        expect(selectDefaultLocale(language, [{ value: locale, label: locale }])).toBe(locale);
    });

    it('does not invent unavailable or ambiguous locales', () => {
        expect(selectDefaultLocale('ja', [{ value: 'en_US' }])).toBe('');
        expect(selectDefaultLocale('xx', [{ value: 'xx_AA' }])).toBe('xx_AA');
        expect(selectDefaultLocale('xx', [{ value: 'xx_AA' }, { value: 'xx_BB' }])).toBe('');
        expect(selectDefaultLocale('xx', [])).toBe('');
    });

    it('preserves current values that no longer appear among choices', () => {
        const labels = { ja: '日本語' };
        expect(getDisplayLabel('ja', labels)).toBe('日本語');
        expect(getDisplayLabel('retired', labels)).toBe('retired');
        expect(getDisplayLabel('toString', labels)).toBe('toString');
        expect(getDisplayLabel('', {})).toBe('未設定');
        expect(getDisplayLabel('')).toBe('未設定');
    });

    it('allows a manually chosen locale and sends only two settings', () => {
        expect(createSaveRequest('ja', 'en_GB', languages, locales)).toEqual({
            errorMessage: '', parameters: { language: 'ja', locale: 'en_GB' }
        });
    });

    it('rejects invalid language and locale before saving', () => {
        expect(createSaveRequest('', 'ja_JP', languages, locales).errorMessage).toContain('言語');
        expect(createSaveRequest('invalid', 'ja_JP', languages, locales).parameters).toBeUndefined();
        expect(createSaveRequest('ja', '', languages, locales).errorMessage).toContain('地域');
        expect(createSaveRequest('ja', 'invalid', languages, locales).parameters).toBeUndefined();
    });
});
