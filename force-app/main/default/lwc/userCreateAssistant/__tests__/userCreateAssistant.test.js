import { createElement } from 'lwc';
import UserCreateAssistant from 'c/userCreateAssistant';
import getForm from '@salesforce/apex/UserCreateAssistantController.getForm';
import { getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import saveUser from '@salesforce/apex/UserCreateAssistantController.saveUser';
import CURRENT_USER_ID from '@salesforce/user/Id';
import getSourceProfileIds from '@salesforce/apex/UserCreateAssistantController.getSourceProfileIds';

jest.mock('@salesforce/apex/UserCreateAssistantController.getSourceProfileIds', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/user/Id', () => ({ default: '005000000000001AAA' }), { virtual: true });
jest.mock('@salesforce/apex/UserCreateAssistantController.getForm', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/UserCreateAssistantController.saveUser', () => ({ default: jest.fn() }), { virtual: true });
const fields = [{ apiName: 'LastName', label: '姓', type: 'text', value: '参照元', canCreate: true, canUpdate: true, required: true }];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, no) => { resolve = ok; reject = no; });
    return { promise, resolve, reject };
}
async function mount() {
    const el = createElement('c-user-create-assistant', { is: UserCreateAssistant });
    document.body.appendChild(el);
    await flush();
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
function review(root) {
    root.querySelectorAll('[data-side]').forEach((el) => { el.checkValidity = () => true; });
    const dialog = root.querySelector('dialog');
    // jsdom には HTMLDialogElement の表示・終了処理がない。
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    [...root.querySelectorAll('lightning-button')].find((el) => el.variant === 'brand').click();
    return dialog;
}
function submit(root) {
    const dialog = review(root);
    dialog.querySelectorAll('lightning-button')[1].click();
}
beforeEach(() => { getSourceProfileIds.mockResolvedValue(['internal']); });
afterEach(() => { document.body.replaceChildren(); jest.resetAllMocks(); });
it.each([15, 18])('本人の %i 桁 ID を選ぶと無効化を解除し、コピー元を変更せずに作成できる', async (length) => {
    getForm.mockResolvedValue({ fields });
    saveUser.mockResolvedValue('new');
    const root = (await mount()).shadowRoot;
    select(root, 'other'); await flush();
    await toggle(root, 'deactivateSource', true);
    edit(input(root, 'source'), '元の編集');

    const selfId = CURRENT_USER_ID.slice(0, length);
    select(root, selfId); await flush();
    expect(option(root, 'deactivateSource')).toMatchObject({ checked: false, disabled: true });
    expect(input(root, 'source')).toBeNull();
    edit(input(root, 'target'), '新規');
    submit(root); await flush();
    expect(saveUser.mock.calls[0][0].request).toMatchObject({
        sourceId: selfId, deactivateSource: false, sourceValuesJson: '{}', targetValuesJson: '{"LastName":"新規"}'
    });

    select(root, 'other'); await flush();
    expect(option(root, 'deactivateSource')).toMatchObject({ checked: false, disabled: false });
    await toggle(root, 'deactivateSource', true);
    expect(input(root, 'source').value).toBe('参照元');
});

it('確認で対象と各設定を示し、キャンセルとユーザー名の重複では保存しない', async () => {
    getForm.mockResolvedValue({fields: [
        {apiName:'Username', label:'ユーザー名', type:'email', value:'copy@example.invalid', canCreate:true, canUpdate:true},
        {apiName:'IsActive', type:'checkbox', value:'true', canCreate:true}
    ]});
    const root = (await mount()).shadowRoot;
    select(root, 'one'); await flush();
    await toggle(root,'deactivateSource',true);
    await toggle(root,'copyPermissionSetGroups',false);
    const username = root.querySelector('[data-side="target"][data-name="Username"]');
    const dialog = review(root); await flush();
    expect(dialog.open).toBe(false);
    expect(root.querySelector('[role="alert"]').textContent).toContain('コピー元と同じ');
    edit(username, 'new@example.invalid');
    review(root); await flush();
    expect(dialog.open).toBe(true);
    expect([...dialog.querySelectorAll('h3')].map(el => el.textContent)).toEqual(['コピー元ユーザー','新規ユーザー','権限の引き継ぎ']);
    expect([...dialog.querySelectorAll('section:first-child dt')].map(el => el.textContent)).toEqual(['氏名','メール','ユーザー名','有効']);
    expect([...dialog.querySelectorAll('lightning-input')].map(el => [el.label, el.checked, el.readOnly])).toEqual([
        ['有効', false, true], ['有効', true, true]
    ]);
    expect(dialog.textContent).toContain('無効化します');
    dialog.querySelector('lightning-button').click(); await flush();
    expect(dialog.open).toBe(false);
    expect(saveUser).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    edit(username, 'COPY@example.invalid');
    review(root); await flush();
    expect(dialog.open).toBe(false);
    expect(root.querySelector('[role="alert"]').textContent).toContain('コピー元と同じ');
    expect(saveUser).not.toHaveBeenCalled();
    const banner = root.querySelector('[role="alert"]');
    expect(root.querySelector('main > header').nextElementSibling).toBe(banner);
    expect(banner.querySelector('a, lightning-button')).toBeNull();
    expect(root.activeElement).toBe(banner);
    edit(username, 'new@example.invalid');
    submit(root); await flush();
    expect(saveUser).toHaveBeenCalledTimes(1);
});
it.each([[['Green'], 'Green'], [[], '']])('複数選択の初期値から %j に変更して新規側だけを保存する', async (selected, stored) => {
    const colors = ['Green', 'Blue'];
    getForm.mockResolvedValue({fields: [{apiName:'Colors__c', label:'色', type:'multipicklist', custom:true,
        canCreate:true, value:'Green;Blue', options:colors.map((value) => ({label:value, value}))}]});
    saveUser.mockResolvedValue('new');
    const root = (await mount()).shadowRoot;
    select(root, 'source');
    await flush();
    const group = root.querySelector('.c-target lightning-dual-listbox');
    expect(group.value).toEqual(colors);
    edit(group, selected);
    submit(root);
    await flush();
    const request = saveUser.mock.calls[0][0].request;
    expect(JSON.parse(request.targetValuesJson)).toEqual({Colors__c:stored});
    expect(JSON.parse(request.sourceValuesJson)).toEqual({});
});
it('左右の初期状態と引き継ぎを表示し、保存エラー後も入力を保持して該当する割り当てだけ外せる', async () => {
    getForm.mockResolvedValue({fields});
    saveUser.mockRejectedValueOnce({body: { message: '権限セットの割り当てに失敗しました。' }}).mockResolvedValueOnce('new');
    const el = await mount(), root = el.shadowRoot;
    select(root, 'one');
    await flush();
    expect(root.querySelector('h1').textContent).toBe('ユーザー作成アシスタント');
    expect(root.querySelector('lightning-record-picker').filter.criteria).toEqual([
        {fieldPath:'ContactId',operator:'eq',value:null}, {fieldPath:'ProfileId',operator:'in',value:['internal']}
    ]);
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
    expect(saveUser).toHaveBeenLastCalledWith({request:{sourceId:'one',deactivateSource:false,copyPermissionSets:false,copyPermissionSetGroups:true,sendResetEmail:true,sourceValuesJson:'{}',targetValuesJson:'{"LastName":"新規"}'}});
    expect(root.querySelector('a').getAttribute('href')).toBe('/lightning/r/User/new/view');
});
it('参照先を ID 入力に切り替えた後も、元側の表示切替で新規側の編集を保持する', async () => {
    getForm.mockResolvedValue({fields: [...fields, {apiName:'ManagerId', label:'上司', type:'reference',
        referenceTo:'User', canCreate:true, canUpdate:true}]});
    const root = (await mount()).shadowRoot;
    select(root, 'one'); await flush();
    const picker = root.querySelector('.c-target lightning-record-picker');
    edit(input(root,'target'), '新規の姓');
    picker.dispatchEvent(new CustomEvent('error', {detail:{error:{errorCode:'ERR_RP003'}}}));
    await flush();
    const manager = root.querySelector('.c-target lightning-input[data-name="ManagerId"]');
    edit(manager, '005000000000001');
    await toggle(root,'deactivateSource',true);
    expect(root.querySelector('.c-source lightning-input[data-name="ManagerId"]')).toBeTruthy();
    edit(input(root,'source'), '変更した元の姓');
    await toggle(root,'deactivateSource',false);
    await toggle(root,'deactivateSource',true);
    expect(input(root,'source').value).toBe('参照元');
    expect(input(root,'target').value).toBe('新規の姓');
    expect(root.querySelector('.c-target [data-name="ManagerId"]').value).toBe('005000000000001');
});

it('対象変更・切断前の応答を破棄し、現在のユーザーだけ再取得する', async () => {
    const first=deferred(), second=deferred();
    getForm.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValue({fields});
    const el=await mount(), root=el.shadowRoot;
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
    const el=await mount(), root=el.shadowRoot;
    select(root,'one'); await flush();
    await toggle(root,'deactivateSource',true);
    edit(input(root,'source'),'旧');
    edit(input(root,'target'),'新');
    submit(root); submit(root);
    await flush();
    el.remove(); document.body.appendChild(el); await flush();
    expect(root.querySelector('lightning-record-picker').disabled).toBe(true);
    expect(saveUser).toHaveBeenCalledTimes(1);
    expect(saveUser.mock.calls[0][0].request.sourceValuesJson).toBe('{"LastName":"旧"}');
    pending.resolve('new'); await flush();
    expect(root.querySelector('.c-source')).toBeNull();
});
it('取得エラーを表示し、コピー元を選び直すとフォームを開く', async () => {
    getForm.mockRejectedValueOnce({body:{message:'取得失敗'}}).mockResolvedValueOnce({fields});
    const root = (await mount()).shadowRoot;
    select(root,'one'); await flush();
    const alert = root.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('取得失敗');
    expect(alert.querySelector('lightning-button')).toBeNull();
    select(root, null); await flush();
    select(root, 'one'); await flush();
    expect(root.querySelector('.c-target')).toBeTruthy();
    expect(root.querySelector('[role="alert"]')).toBeNull();
});

it('未編集の新規項目も保存し、明示的なクリアとコピー元の編集を区別する', async () => {
    getForm.mockResolvedValue({fields: [...fields,
        {apiName:'Department', label:'部署', type:'text', value:'営業', canCreate:true, canUpdate:true},
        {apiName:'Choice__c', label:'区分', type:'picklist', value:null, nillable:true, canCreate:true},
        {apiName:'ProfileId', type:'readonly', value:'profile', canCreate:false},
        {apiName:'IsActive', type:'checkbox', value:'false', canCreate:true}
    ]});
    saveUser.mockResolvedValue('new');
    const root = (await mount()).shadowRoot;
    select(root,'one'); await flush();
    await toggle(root,'deactivateSource',true);
    edit(input(root,'source'),'元だけ変更');
    edit(root.querySelector('[data-side="target"][data-name="Department"]'),'');
    submit(root); await flush();
    const {sourceValuesJson,targetValuesJson}=saveUser.mock.calls[0][0].request;
    expect(JSON.parse(sourceValuesJson)).toEqual({LastName:'元だけ変更'});
    expect(JSON.parse(targetValuesJson)).toEqual({LastName:'参照元',Department:null,Choice__c:null,IsActive:true});
});

it.each([[true, true], [false, false]])('コピー元の有効状態が %s でも新規側は有効で、メール送信の選択 %s を確認・保存に反映する', async (initial, sendEmail) => {
    getForm.mockResolvedValue({fields: [
        {apiName:'IsActive', label:'有効', type:'checkbox', value:String(initial), canCreate:true},
        {apiName:'Email', label:'メール', type:'email', value:'new@example.invalid', canCreate:true}
    ]});
    saveUser.mockResolvedValue('new');
    const root = (await mount()).shadowRoot;
    select(root,'source'); await flush();
    const source = root.querySelector('.c-source lightning-input');
    const target = root.querySelector('.c-target lightning-input');
    expect(source).toMatchObject({type:'checkbox', checked:initial, readOnly:true});
    expect(target).toMatchObject({type:'checkbox', checked:true, readOnly:true});
    expect(option(root,'sendResetEmail').checked).toBe(true);
    if (!sendEmail) await toggle(root,'sendResetEmail',false);
    const dialog = review(root); await flush();
    const emailSetting = [...dialog.querySelectorAll('dt')].find(label => label.textContent === 'パスワードリセットメール');
    expect(emailSetting.nextElementSibling.textContent).toBe(sendEmail ? '送信する' : '送信しない');
    expect(dialog.textContent).toContain('new@example.invalid');
    dialog.querySelectorAll('lightning-button')[1].click(); await flush();
    expect(saveUser.mock.calls[0][0].request.sendResetEmail).toBe(sendEmail);
    expect(JSON.parse(saveUser.mock.calls[0][0].request.targetValuesJson).IsActive).toBe(true);
});

it('対象外の値を明示し、制御項目を左右独立に評価して選び直した値だけを保存する', async () => {
    const choices = ['Green','Blue'].map(value => ({value, label:value}));
    getForm.mockResolvedValue({fields:[
        {apiName:'Enabled__c', label:'制御', type:'checkbox', value:'true', canCreate:true, canUpdate:true},
        {apiName:'Colors__c', label:'色', type:'multipicklist', controllerName:'Enabled__c', custom:true,
            canCreate:true, canUpdate:true, value:'Green;Retired', displayValue:'緑、旧値', options:choices}
    ]});
    const root = (await mount()).shadowRoot;
    select(root, 'one'); await flush();
    getPicklistValuesByRecordType.emit({picklistFieldValues:{Colors__c:{
        controllerValues:{true:1,false:0}, values:choices.map((choice,i)=>({...choice,validFor:[1-i]}))
    }}});
    await flush();
    const group = side => root.querySelector('.c-' + side + ' lightning-dual-listbox');
    expect(root.querySelector('.c-source').textContent).toContain('緑、旧値');
    expect(group('target').options.map(o => o.label)).toEqual(['Green','Retired（選択対象外）']);
    expect(review(root).open).toBe(false); await flush();
    expect(root.querySelector('[role="alert"]').textContent).toContain('選択対象外');
    edit(group('target'), ['Green']); await flush();
    await toggle(root, 'deactivateSource', true);
    const control = root.querySelector('.c-target [data-name="Enabled__c"]');
    control.checked = false;
    control.dispatchEvent(new CustomEvent('change')); await flush();
    expect(group('source').options[0].value).toBe('Green');
    expect(group('target').options.map(o => o.label)).toEqual(['Blue','Green（選択対象外）']);
    expect(review(root).open).toBe(false);
    edit(group('target'), ['Blue']); await flush();
    submit(root); await flush();
    expect(JSON.parse(saveUser.mock.calls[0][0].request.targetValuesJson)).toMatchObject({Colors__c:'Blue',Enabled__c:false});
    expect(JSON.parse(saveUser.mock.calls[0][0].request.sourceValuesJson)).toEqual({});
});

it('リッチテキストを書式付きで表示し、必須・文字数を確認して編集後の HTML を保存する', async () => {
    getForm.mockResolvedValue({fields:[{apiName:'Note__c',label:'備考',type:'textarea',richText:true,
        canCreate:true,required:true,maxLength:40,value:'<p><b>元</b></p>'}]});
    const root = (await mount()).shadowRoot;
    select(root,'one'); await flush();
    expect(root.querySelector('lightning-formatted-rich-text').value).toBe('<p><b>元</b></p>');
    const editor = root.querySelector('lightning-input-rich-text');
    const expectInvalid = async (invalid) => {
        edit(editor, invalid);
        expect(review(root).open).toBe(false);
        await flush();
        expect(root.querySelector('[role="alert"]').textContent).toContain('備考');
    };
    await expectInvalid('<p><br></p>');
    await expectInvalid('長'.repeat(41));
    edit(editor,'<p><b>編集</b></p>');
    submit(root); await flush();
    expect(JSON.parse(saveUser.mock.calls[0][0].request.targetValuesJson).Note__c).toBe('<p><b>編集</b></p>');
});

it('無効になった単一選択値を解除すると任意項目を空で保存できる', async () => {
    getForm.mockResolvedValue({fields:[{apiName:'Choice__c',label:'区分',type:'picklist',canCreate:true,
        value:'Old',options:[{label:'現行',value:'Current'}]}]});
    const root = (await mount()).shadowRoot;
    select(root,'one'); await flush();
    const choice = root.querySelector('.c-target lightning-combobox');
    expect(choice.options).toContainEqual({label:'Old（選択対象外）',value:'Old'});
    expect(review(root).open).toBe(false);
    edit(choice, ''); await flush();
    expect(choice.options.map(item=>item.value)).toEqual(['','Current']);
    submit(root); await flush();
    expect(JSON.parse(saveUser.mock.calls[0][0].request.targetValuesJson)).toEqual({Choice__c:null});
});

const dependentForm = [...fields,
    { apiName: 'Flag__c', type: 'checkbox', value: 'true', canCreate: true },
    { apiName: 'Color__c', label: '色', type: 'picklist', controllerName: 'Flag__c', value: 'Green', canCreate: true }
];

function emitColors(validFor) {
    getPicklistValuesByRecordType.emit({ picklistFieldValues: {
        Color__c: { controllerValues: { true: 0, false: 1 }, values: [{ label: '緑', value: 'Green', validFor }] }
    } });
}

function accessError(reason) {
    return { body: { message: '利用権限の確認：' + reason } };
}

it.each([
    '実行ユーザーのシステム権限を取得できませんでした。',
    '「設定・定義を参照」権限が必要です。',
    '「ユーザーの管理」権限が必要です。',
    'ユーザーオブジェクトの参照権限が必要です。',
    'ユーザーオブジェクトの作成権限が必要です。',
    'ユーザーオブジェクトの編集権限が必要です。'
])('権限エラー「%s」を共通の通知に表示し、検索を閉じる', async reason => {
    const access = deferred();
    getSourceProfileIds.mockReturnValueOnce(access.promise);
    const root = (await mount()).shadowRoot;
    expect(root.querySelector('lightning-record-picker')).toBeNull();
    access.reject(accessError(reason)); await flush();
    const alert = root.querySelector('[role="alert"]');
    expect(alert.textContent).toBe(reason);
    expect(alert.querySelector('lightning-button')).toBeNull();
    expect(root.querySelector('[role="status"]')).toBeNull();
    expect(root.querySelector('lightning-record-picker')).toBeNull();
    expect(getForm).not.toHaveBeenCalled();
    expect(getSourceProfileIds).toHaveBeenCalledTimes(1);
});

it('検索条件の取得失敗を表示し、検索を閉じる', async () => {
    getSourceProfileIds.mockRejectedValueOnce(new Error('network'));
    const root = (await mount()).shadowRoot;
    expect(root.querySelector('[role="alert"]').textContent).toContain('検索条件を取得できませんでした');
    expect(root.querySelector('lightning-record-picker')).toBeNull();
    expect(root.querySelector('[role="alert"] lightning-button')).toBeNull();
});

it('コピー元取得時に権限を失った場合は検索を閉じる', async () => {
    const reason = '「ユーザーの管理」権限が必要です。';
    getForm.mockRejectedValueOnce(accessError(reason));
    const root = (await mount()).shadowRoot;
    select(root, 'one'); await flush();
    expect(root.querySelector('lightning-record-picker')).toBeNull();
    expect(root.querySelector('[role="alert"]').textContent).toContain(reason);
});

it('保存時に権限を失った場合は入力と検索を閉じる', async () => {
    getForm.mockResolvedValue({ fields });
    const reason = 'ユーザーオブジェクトの編集権限が必要です。';
    saveUser.mockRejectedValueOnce(accessError(reason));
    const root = (await mount()).shadowRoot;
    select(root, 'one'); await flush();
    submit(root); await flush();
    expect(root.querySelector('.c-target')).toBeNull();
    expect(root.querySelector('[role="alert"]').textContent).toContain(reason);
    expect(root.querySelector('lightning-record-picker')).toBeNull();
});

async function failDependenciesWhileSaving() {
    getForm.mockResolvedValue({ fields: dependentForm });
    const save = deferred();
    saveUser.mockReturnValue(save.promise);
    const root = (await mount()).shadowRoot;
    select(root, 'one'); await flush();
    emitColors([0]); await flush();
    edit(input(root, 'target'), '編集した姓');
    submit(root); await flush();
    getPicklistValuesByRecordType.error(); await flush();
    return { root, save };
}

it('保存中の候補取得エラーは再読み込みを促さず、作成成功後に通知を残さない', async () => {
    const { root, save } = await failDependenciesWhileSaving();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    save.resolve('new'); await flush();
    expect(root.querySelector('a').textContent).toContain('作成したユーザー');
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.textContent).not.toContain('読み込み中');
});

it('保存と候補取得の失敗を一つの通知に表示する', async () => {
    const { root, save } = await failDependenciesWhileSaving();
    save.reject({ body: { message: '保存失敗' } }); await flush();
    const alerts = root.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toContain('保存失敗');
    expect(alerts[0].textContent).toContain('連動選択リストの候補を取得できませんでした。');
    expect(alerts[0].querySelector('lightning-button')).toBeNull();
    expect(root.querySelector('.c-target')).toBeNull();
});

it('候補取得に失敗すると確認画面を閉じ、エラーを表示して保存を止める', async () => {
    getForm.mockResolvedValue({ fields: dependentForm });
    const root = (await mount()).shadowRoot;
    select(root, 'one'); await flush();
    emitColors([0]); await flush();
    const dialog = review(root);
    expect(dialog.open).toBe(true);
    getPicklistValuesByRecordType.error(); await flush();
    expect(dialog.open).toBe(false);
    expect(root.querySelector('[role="alert"]').textContent).toContain('連動選択リストの候補を取得できませんでした。');
    expect(root.querySelector('.c-target')).toBeNull();
    expect(saveUser).not.toHaveBeenCalled();
});

it('確認中の候補更新で選択が無効になると確認を閉じ、修正後の値だけを送信する', async () => {
    getForm.mockResolvedValue({ fields: dependentForm });
    const root = (await mount()).shadowRoot;
    select(root, 'one'); await flush();
    emitColors([0]); await flush();
    const dialog = review(root); await flush();
    emitColors([0, 1]); await flush();
    expect(dialog.open).toBe(true);
    emitColors([1]); await flush();
    expect(dialog.open).toBe(false);
    expect(root.querySelector('[role="alert"]').textContent).toContain('新規ユーザーの「色」');
    dialog.querySelectorAll('lightning-button')[1].click();
    expect(saveUser).not.toHaveBeenCalled();
    edit(root.querySelector('.c-target lightning-combobox'), ''); await flush();
    submit(root); await flush();
    expect(JSON.parse(saveUser.mock.calls[0][0].request.targetValuesJson).Color__c).toBeNull();
});

it('画像を含む既存の HTML を未編集のまま新規側へコピーする', async () => {
    const html = '<p><img src="/resource/ExampleImage" alt="既存画像"></p>';
    getForm.mockResolvedValue({ fields: [{ apiName: 'Note__c', label: '備考', type: 'textarea',
        richText: true, value: html, canCreate: true, required: true }] });
    const root = (await mount()).shadowRoot;
    select(root, 'one'); await flush();
    expect(root.querySelector('.c-source lightning-formatted-rich-text').value).toBe(html);
    expect(root.querySelector('.c-target lightning-input-rich-text')).toMatchObject({
        disabledCategories: 'INSERT_CONTENT', value: html
    });
    submit(root); await flush();
    expect(JSON.parse(saveUser.mock.calls[0][0].request.targetValuesJson).Note__c).toBe(html);
});
