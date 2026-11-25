import { createElement } from 'lwc';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import LookupObjectIcon from 'c/lookupObjectIcon';

afterEach(() => document.body.replaceChildren());

it('組織の画像と色を表示し、選択を切り替えた後の古い定義と取得失敗は代替表示にする', async () => {
    const element = createElement('c-lookup-object-icon', { is: LookupObjectIcon });
    element.objectApiName = 'Case';
    document.body.appendChild(element);
    const root = element.shadowRoot;
    const url = '/img/icon/case.png';
    await Promise.resolve();
    getObjectInfo.emit({ apiName: 'Case', themeInfo: { color: 'FF538A', iconUrl: url } });
    await Promise.resolve();
    expect(root.querySelector('img').getAttribute('src')).toBe(url);
    expect(root.querySelector('img').style.backgroundColor).toBe('rgb(255, 83, 138)');

    element.objectApiName = 'Group';
    await Promise.resolve();
    expect(getObjectInfo.getLastConfig()).toEqual({ objectApiName: 'Group' });
    expect(root.querySelector('img')).toBeNull();
    getObjectInfo.error();
    await Promise.resolve();
    expect(root.querySelector('lightning-icon').iconName).toBe('standard:groups');

    element.objectApiName = 'Example__c';
    await Promise.resolve();
    getObjectInfo.emit({ apiName: 'Example__c', themeInfo: {} });
    await Promise.resolve();
    expect(root.querySelector('lightning-icon').iconName).toBe('standard:custom_entity');
});

it('定義のない検索条件と画像の読み込みに失敗した標準オブジェクトに代替を表示する', async () => {
    const element = createElement('c-lookup-object-icon', { is: LookupObjectIcon });
    document.body.appendChild(element);
    const root = element.shadowRoot;
    expect(root.querySelector('lightning-icon').iconName).toBe('standard:custom_entity');
    element.objectApiName = 'User';
    await Promise.resolve();
    getObjectInfo.emit({ apiName: 'User', themeInfo: { iconUrl: '/img/user.png' } });
    await Promise.resolve();
    root.querySelector('img').dispatchEvent(new CustomEvent('error'));
    await Promise.resolve();
    expect(root.querySelector('lightning-icon').iconName).toBe('standard:user');
});
