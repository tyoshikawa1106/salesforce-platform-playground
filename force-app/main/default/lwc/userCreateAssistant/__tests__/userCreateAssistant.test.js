import { createElement } from 'lwc';
import UserCreateAssistant from 'c/userCreateAssistant';
import getForm from '@salesforce/apex/UserCreateAssistantController.getForm';
import saveUser from '@salesforce/apex/UserCreateAssistantController.saveUser';

jest.mock('@salesforce/apex/UserCreateAssistantController.getForm', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/UserCreateAssistantController.saveUser', () => ({ default: jest.fn() }), { virtual: true });
const fields = [{ apiName: 'LastName', label: '姓', type: 'text', value: '参照元', canCreate: true, canUpdate: true, required: true }];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, no) => { resolve = ok; reject = no; });
    return { promise, resolve, reject };
}
function mount() {
    const el = createElement('c-user-create-assistant', { is: UserCreateAssistant });
    document.body.appendChild(el);
    return el;
}
const select = (root, recordId) => root.querySelector('lightning-record-picker').dispatchEvent(new CustomEvent('change', {detail: {recordId}}));
const input = (root, side) => root.querySelector('[data-side="' + side + '"][data-name="LastName"]');
const option = (root, name) => [...root.querySelectorAll('lightning-input')].find((i) => i.name === name);
async function toggle(root, name, checked) {
    const el = option(root, name);
    el.checked = checked;
    el.dispatchEvent(new CustomEvent('change'));
    await flush();
}
function edit(el, value) {
    el.value = value;
    el.dispatchEvent(new CustomEvent('change', {detail: {value}}));
}
function submit(root) {
    root.querySelectorAll('[data-side]').forEach((el) => { el.checkValidity = () => true; });
    [...root.querySelectorAll('lightning-button')].find((el) => el.variant === 'brand').click();
}
afterEach(() => { document.body.replaceChildren(); jest.resetAllMocks(); });
it('左右の初期状態と引き継ぎを表示し、保存エラー後も入力を保持して該当する割り当てだけ外せる', async () => {
    getForm.mockResolvedValue({fields});
    saveUser.mockRejectedValueOnce({body: { message: '権限セットの割り当てに失敗しました。' }}).mockResolvedValueOnce('new');
    const el = mount(), root = el.shadowRoot;
    select(root, 'one');
    await flush();
    expect(root.querySelector('h1').textContent).toBe('ユーザー作成アシスタント');
    expect(root.querySelector('lightning-record-picker').filter.criteria).toEqual([{fieldPath:'ContactId',operator:'eq',value:null}]);
    expect(root.querySelectorAll('section.c-panel.slds-box')).toHaveLength(2);
    expect(root.querySelector('.c-source').textContent).toContain('参照元');
    expect(input(root,'source')).toBeNull();
    expect(input(root,'target').value).toBe('参照元');
    expect(option(root,'deactivateSource').checked).toBe(false);
    expect(option(root,'copyPermissionSets').checked).toBe(true);
    expect(option(root,'copyPermissionSetGroups').checked).toBe(true);
    await expect(el).toBeAccessible();
    edit(input(root,'target'),'新規');
    await toggle(root,'deactivateSource',true);
    edit(input(root,'source'),'退任');
    await toggle(root,'deactivateSource',false);
    submit(root);
    await flush();
    expect(root.querySelector('[role="alert"]').textContent).toContain('権限セット');
    expect(input(root,'target').value).toBe('新規');
    await toggle(root,'copyPermissionSets',false);
    submit(root);
    await flush();
    expect(saveUser).toHaveBeenLastCalledWith({request:{sourceId:'one',deactivateSource:false,copyPermissionSets:false,copyPermissionSetGroups:true,sourceValuesJson:'{}',targetValuesJson:'{"LastName":"新規"}'}});
    expect(root.querySelector('a').getAttribute('href')).toBe('/lightning/r/User/new/view');
});
it('対象変更・切断前の応答を破棄し、現在のユーザーだけ再取得する', async () => {
    const first=deferred(), second=deferred();
    getForm.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValue({fields});
    const el=mount(), root=el.shadowRoot;
    select(root,'one'); select(root,'two');
    first.reject({body:{message:'古い失敗'}});
    await flush();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    el.remove();
    document.body.appendChild(el);
    await flush();
    second.resolve({fields:[]});
    await flush();
    expect(root.querySelector('.c-source').textContent).toContain('参照元');
    expect(getForm).toHaveBeenLastCalledWith({sourceId:'two'});
    select(root,null);
    await flush();
    expect(root.querySelector('.c-source')).toBeNull();
});
it('送信済みの無効化付き保存は再接続後も二重実行せず、成功時にフォームを閉じる', async () => {
    getForm.mockResolvedValue({fields});
    const pending=deferred();
    saveUser.mockReturnValue(pending.promise);
    const el=mount(), root=el.shadowRoot;
    select(root,'one'); await flush();
    await toggle(root,'deactivateSource',true);
    edit(input(root,'source'),'旧');
    edit(input(root,'target'),'新');
    submit(root); submit(root);
    el.remove(); document.body.appendChild(el); await flush();
    expect(root.querySelector('lightning-record-picker').disabled).toBe(true);
    expect(saveUser).toHaveBeenCalledTimes(1);
    expect(saveUser.mock.calls[0][0].request.sourceValuesJson).toBe('{"LastName":"旧"}');
    pending.resolve('new'); await flush();
    expect(root.querySelector('.c-source')).toBeNull();
});
it('取得エラーから同じ対象を読み直せる', async () => {
    getForm.mockRejectedValueOnce({body:{message:'取得失敗'}}).mockResolvedValueOnce({fields});
    const root = mount().shadowRoot;
    select(root,'one'); await flush();
    root.querySelector('lightning-button').click(); await flush();
    expect(root.querySelector('.c-target')).toBeTruthy();
    expect(root.querySelector('[role="alert"]')).toBeNull();
});

it('未編集の新規項目も保存し、明示的なクリアとコピー元の編集を区別する', async () => {
    getForm.mockResolvedValue({fields: [...fields,
        {apiName:'Department', label:'部署', type:'text', value:'営業', canCreate:true, canUpdate:true},
        {apiName:'ProfileId', type:'readonly', value:'profile', canCreate:false},
        {apiName:'IsActive', type:'checkbox', value:'false', canCreate:true}
    ]});
    saveUser.mockResolvedValue('new');
    const root = mount().shadowRoot;
    select(root,'one'); await flush();
    await toggle(root,'deactivateSource',true);
    edit(input(root,'source'),'元だけ変更');
    edit(root.querySelector('[data-side="target"][data-name="Department"]'),'');
    submit(root); await flush();
    const {sourceValuesJson,targetValuesJson}=saveUser.mock.calls[0][0].request;
    expect(JSON.parse(sourceValuesJson)).toEqual({LastName:'元だけ変更'});
    expect(JSON.parse(targetValuesJson)).toEqual({LastName:'参照元',Department:null,IsActive:false});
});

it.each([true, false])('有効チェックをコピー元（%s）から反転して新規側だけ保存できる', async (initial) => {
    getForm.mockResolvedValue({fields: [{apiName:'IsActive', label:'有効', type:'checkbox', value:String(initial), canCreate:true, required:true}]});
    saveUser.mockResolvedValue('new');
    const root = mount().shadowRoot;
    select(root,'source'); await flush();
    const source = root.querySelector('.c-source lightning-input');
    const target = root.querySelector('[data-side="target"][data-name="IsActive"]');
    expect(source).toMatchObject({type:'checkbox', checked:initial, readOnly:true, variant:'label-stacked'});
    expect(target).toMatchObject({type:'checkbox', checked:initial, variant:'label-stacked'});
    expect(target.required).toBeFalsy();
    target.checked = !initial;
    target.dispatchEvent(new CustomEvent('change'));
    submit(root); await flush();
    const {sourceValuesJson,targetValuesJson} = saveUser.mock.calls[0][0].request;
    expect(JSON.parse(sourceValuesJson)).toEqual({});
    expect(JSON.parse(targetValuesJson)).toEqual({IsActive:!initial});
});
