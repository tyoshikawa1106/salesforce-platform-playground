import { getErrorMessages, reduceErrors } from 'c/salesforceApiUtil';

describe('Salesforce API応答のメッセージ整形', () => {
    it('ApexとUI APIの異なる応答形式を入力順で表示する', () => {
        const errors = [
            { body: { message: 'Apexの公開案内' } },
            { body: [{ message: '項目の拒否' }, { message: 'レコードの拒否' }] }
        ];

        expect(getErrorMessages(errors, '代替案内')).toEqual([
            'Apexの公開案内',
            '項目の拒否, レコードの拒否'
        ]);
        expect(reduceErrors(errors, '代替案内')).toBe(
            'Apexの公開案内; 項目の拒否, レコードの拒否'
        );
    });

    it('応答がない場合の既存メッセージと代替文言の優先順位を維持する', () => {
        expect(reduceErrors(new Error('通信失敗'), '代替案内')).toBe('通信失敗');
        expect(reduceErrors({}, '代替案内')).toBe('代替案内');
        expect(reduceErrors({ body: { message: '' }, message: '外側の案内' }, '代替案内')).toBe('');
        expect(reduceErrors({ body: { message: 'APIの案内' }, message: '外側の案内' }, '代替案内')).toBe('APIの案内');
    });

    it('欠落した要素を追加の案内へ置換せず、空の結果を維持する', () => {
        expect(getErrorMessages(null, '代替案内')).toEqual([]);
        expect(reduceErrors(undefined, '代替案内')).toBe('');
        expect(reduceErrors([], '代替案内')).toBe('');
        expect(reduceErrors([null, { body: { message: '有効な案内' } }, undefined], '代替案内')).toBe('有効な案内');
    });

    it('入力の応答情報を書き換えない', () => {
        const body = Object.freeze({ message: 'APIの案内' });
        const response = Object.freeze({ body });

        expect(reduceErrors(response, '代替案内')).toBe('APIの案内');
        expect(response.body).toBe(body);
    });
});
