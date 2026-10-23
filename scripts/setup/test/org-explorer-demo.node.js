// 実行コマンド: node --test scripts/setup/test/org-explorer-demo.node.js
// 用途: デモ定義の整合性、対象組織の安全判定、再現後の照合と失敗時の後始末を確認する。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { main, parseArgs, queryRecords, readApexResult } = require('../seed-org-explorer');
const {
    buildSources,
    readDefinition,
    validatePlan,
    verifyRecords,
    userFields
} = require('../internal/org-explorer-demo');

const { plan, template } = readDefinition();
const silent = { write() {} };
const orgId = '00D000000000001';
const ok = (result) => ({ status: 0, stdout: JSON.stringify({ status: 0, result }), stderr: '' });
const query = (records) => ok({ done: true, totalSize: records.length, records });

function recordsFromPlan() {
    const roleIds = new Map(plan.roles.map((row, index) => [row.key, `role-${index}`]));
    const userIds = new Map(plan.users.map((row, index) => [row.Email, `user-${index}`]));
    return {
        roles: plan.roles.map((row) => ({
            Id: roleIds.get(row.key),
            DeveloperName: row.key,
            Name: row.name,
            ParentRoleId: roleIds.get(row.parent) ?? null
        })),
        users: plan.users.map(({ role, manager, ...row }) => ({
            ...row,
            ...plan.userSettings,
            Id: userIds.get(row.Email),
            UserRoleId: roleIds.get(role),
            ManagerId: userIds.get(manager) ?? null,
            IsActive: false,
            Profile: { Name: 'Standard User', UserLicense: { Name: 'Salesforce' } }
        }))
    };
}

function createHarness({
    type = 'scratch',
    answer = 'y',
    apexFailure = false,
    apexFailureAt = null,
    incomplete = false,
    mismatch = false,
    configResult = [{ success: true, value: 'test-org' }]
} = {}) {
    const calls = [];
    const data = recordsFromPlan();
    let apexPath;
    let apexCalls = 0;
    let promptClosed = false;
    const output = [];
    let confirmationCount = 0;
    let confirmationOutput = '';
    const runSfCommand = (args) => {
        calls.push(args);
        if (args[0] === 'config') {
            assert.deepEqual(args, ['config', 'get', 'target-org', '--json']);
            return ok(configResult);
        }
        if (args[0] === 'org') {
            const org = {
                alias: 'test-org',
                username: 'test@example.com',
                instanceUrl: 'https://example.my.salesforce.com',
                orgId,
                isSandbox: type === 'sandbox',
                orgEdition:
                    type === 'unknown'
                        ? undefined
                        : type === 'developer' || type === 'scratch'
                          ? 'Developer Edition'
                          : 'Enterprise Edition'
            };
            return ok({
                scratchOrgs: type === 'scratch' ? [org] : [],
                nonScratchOrgs: type === 'scratch' ? [] : [org],
                sandboxes: type === 'sandbox' ? [org] : []
            });
        }
        assert.equal(args[args.indexOf('--target-org') + 1], 'test@example.com');
        if (args[0] === 'apex') {
            apexPath = args[args.indexOf('--file') + 1];
            assert.ok(fs.readFileSync(apexPath, 'utf8').includes("EncodingUtil.base64Decode('"));
            apexCalls++;
            const source = fs.readFileSync(apexPath, 'utf8');
            const payload = JSON.parse(Buffer.from(source.match(/base64Decode\('([^']+)'\)/)[1], 'base64').toString());
            return ok({
                success: !apexFailure && apexCalls !== apexFailureAt,
                compiled: true,
                exceptionMessage: '失敗の試験',
                logs: `ORG_EXPLORER_SEED rolesCreated=0 rolesSkipped=39 usersCreated=0 usersSkipped=${payload.users.length}`
            });
        }
        const soql = args[args.indexOf('--query') + 1];
        if (soql === 'SELECT Id FROM Organization') return query([{ Id: orgId }]);
        if (soql.includes('FROM UserRole')) return query(data.roles);
        if (incomplete) return ok({ done: false, totalSize: data.users.length, records: data.users.slice(0, 1) });
        if (mismatch) data.users[0].IsActive = true;
        return query(data.users);
    };
    return {
        calls,
        output,
        run: (argv = [], internalTargetOrg) =>
            main({
                argv,
                targetOrg: internalTargetOrg,
                runSfCommand,
                stdout: { write: (text) => output.push(text) },
                stderr: silent,
                createPrompt: () => ({
                    question: async () => {
                        confirmationCount++;
                        confirmationOutput = output.join('');
                        return answer;
                    },
                    close: () => {
                        promptClosed = true;
                    }
                })
            }),
        isClean: () => !apexPath || !fs.existsSync(apexPath),
        promptClosed: () => promptClosed,
        confirmationCount: () => confirmationCount,
        confirmationOutput: () => confirmationOutput
    };
}

test('データ定義は既存デモの件数と会社・取締役・部署・上司関係を持ち、IDを固定しない', () => {
    assert.equal(plan.roles.length, 39);
    assert.equal(plan.users.length, 264);
    assert.equal(plan.roles[0].name, 'サンプルカンパニー');
    assert.equal(plan.roles.find((row) => row.key === 'Directors').name, '取締役');
    assert.ok(plan.users.some((row) => row.Department.startsWith('マーケティング部')));
    assert.ok(plan.users.some((row) => row.Department.startsWith('法務部')));
    assert.equal(plan.users.filter((row) => row.manager === null).length, 1);
    assert.equal(plan.users[0].LastName, '山田');
    assert.equal(plan.users[0].Phone, '+1-202-555-0100');
    assert.deepEqual(new Set(plan.users.map((row) => row.Title)), new Set(['代表取締役', '部長', '課長', '担当']));
    const international = plan.users.filter((row) => row.Department === '営業部 海外営業課');
    const sectionManager = international.find((row) => row.Title === '課長');
    assert.equal(international.length, 5);
    assert.equal(sectionManager.role, 'InternationalSalesSection');
    assert.equal(sectionManager.manager, plan.users.find((row) => row.role === 'SalesDepartment').Email);
    assert.equal(
        international.filter((row) => row.manager === sectionManager.Email && row.role === 'InternationalSalesStaff')
            .length,
        4
    );
    assert.ok(!JSON.stringify(plan).match(/00[De5][A-Za-z0-9]{12}/));
});

test('順序を逆転しても親と上司を先に解決する', () => {
    const reversed = structuredClone(plan);
    reversed.roles.reverse();
    reversed.users.reverse();
    const result = validatePlan(reversed);
    assert.equal(result.roles[0].parent, null);
    assert.equal(result.users[0].manager, null);
});

for (const [name, mutate] of [
    ['ロール重複', (p) => p.roles.push({ ...p.roles[0] })],
    [
        '旧API名の型違い',
        (p) => {
            p.roles[0].previousKey = 123;
        }
    ],
    [
        '旧API名重複',
        (p) => {
            p.roles[1].previousKey = p.roles[0].previousKey;
        }
    ],
    [
        'ロール循環',
        (p) => {
            p.roles[0].parent = p.roles[1].key;
        }
    ],
    [
        '上司欠落',
        (p) => {
            p.users[1].manager = 'missing@example.com';
        }
    ],
    [
        '上司循環',
        (p) => {
            p.users[0].manager = p.users[1].Email;
        }
    ],
    ['ユーザー重複', (p) => p.users.push({ ...p.users[0] })],
    [
        '従業員番号なし',
        (p) => {
            delete p.users[0].EmployeeNumber;
        }
    ],
    [
        '従業員番号形式',
        (p) => {
            p.users[0].EmployeeNumber = '123';
        }
    ],
    [
        '従業員番号重複',
        (p) => {
            p.users[1].EmployeeNumber = p.users[0].EmployeeNumber;
        }
    ],
    [
        '対象外メール',
        (p) => {
            p.users[0].Email = 'real@example.com';
        }
    ],
    [
        '実番号',
        (p) => {
            p.users[0].Phone = '03-1234-5678';
        }
    ],
    [
        '電話重複',
        (p) => {
            p.users[1].Phone = p.users[0].Phone;
        }
    ],
    [
        '所属欠落',
        (p) => {
            p.users[0].role = 'OtherRole';
        }
    ],
    [
        '余分な更新項目',
        (p) => {
            p.users[0].IsActive = true;
        }
    ]
]) {
    test(`不正な定義を接続前に拒否する: ${name}`, () => {
        const input = structuredClone(plan);
        mutate(input);
        assert.throws(() => validatePlan(input), /デモ定義/);
    });
}

test('日本語と引用符を含む定義をコードとして解釈せずに合成する', () => {
    const input = structuredClone(plan);
    input.roles[0].name = "架空 ' \\ 会社";
    const source = buildSources(input, template, orgId)[0];
    const encoded = source.match(/base64Decode\('([^']+)'\)/)[1];
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString());
    assert.equal(payload.roles[0][1], input.roles[0].name);
    assert.equal(payload.orgId, orgId);
    assert.equal(payload.users[0][3], input.users[0].Email);
    assert.equal(payload.users[0][userFields.indexOf('EmployeeNumber')], input.users[0].EmployeeNumber);
    assert.equal(payload.users[0][userFields.length], input.users[0].role);
    assert.equal(payload.users[0][userFields.length + 1], input.users[0].manager);
    assert.ok(Buffer.byteLength(source) < 32768);
    assert.throws(() => buildSources(plan, template, "'; delete users;"));
});

test('保存後はIDではなく全項目と親子・上司関係を照合する', () => {
    const { roles, users } = recordsFromPlan();
    assert.deepEqual(verifyRecords(plan, roles, users), { roles: 39, users: 264 });
    users[0].Title = '違う役職';
    assert.throws(() => verifyRecords(plan, roles, users), /ユーザー項目/);
});

for (const [name, mutate] of [
    [
        '有効化',
        (d) => {
            d.users[0].IsActive = true;
        }
    ],
    [
        '外部の上司',
        (d) => {
            d.users[0].ManagerId = 'external';
        }
    ],
    [
        '外部の親ロール',
        (d) => {
            d.roles[0].ParentRoleId = 'external';
        }
    ],
    [
        '所属違い',
        (d) => {
            d.users[0].UserRoleId = d.roles[0].Id;
        }
    ],
    [
        'プロファイル違い',
        (d) => {
            d.users[0].Profile.Name = '管理者';
        }
    ],
    [
        '件数不足',
        (d) => {
            d.users.pop();
        }
    ]
]) {
    test(`照合で不一致を検知する: ${name}`, () => {
        const data = recordsFromPlan();
        mutate(data);
        assert.throws(() => verifyRecords(plan, data.roles, data.users));
    });
}

test('dry-runは組織確認・投入・確認入力を実行しない', async () => {
    const h = createHarness();
    assert.equal(await h.run(['--dry-run']), 0);
    assert.deepEqual(h.calls, []);
});

for (const [type, label] of [
    ['production', '本番'],
    ['sandbox', 'Sandbox'],
    ['developer', '通常のDeveloper Edition'],
    ['unknown', '種別を確定できない組織']
]) {
    for (const mode of [[], ['--verify']]) {
        test(`${label}では${mode.length ? '照合' : '作成'}を開始しない`, async () => {
            const h = createHarness({ type });
            assert.equal(await h.run([...mode]), 1);
            assert.equal(h.calls.length, 2, '設定と組織一覧の確認だけで停止する');
            assert.equal(h.calls[0][0], 'config');
            assert.equal(h.calls[1][0], 'org');
            assert.equal(h.confirmationCount(), 0, '投入確認へ進ませない');
            assert.equal(h.promptClosed(), false);
            assert.ok(h.isClean());
        });
    }
}

for (const answer of ['', 'n', 'yes', 'YES']) {
    test(`y・Y以外の回答ではデータ操作を開始しない: ${JSON.stringify(answer)}`, async () => {
        const h = createHarness({ answer });
        assert.equal(await h.run(), 0);
        assert.equal(h.calls.length, 2);
        assert.equal(h.confirmationCount(), 1);
        assert.ok(h.promptClosed());
        assert.ok(h.isClean());
    });
}

for (const answer of ['y', 'Y']) {
    test(`接続先を表示して${answer}の承認後だけ投入する`, async () => {
        const h = createHarness({ answer });
        assert.equal(await h.run(), 0);
        assert.equal(h.confirmationCount(), 1);
        for (const expected of [
            '接続組織を確認してください。',
            'Alias:',
            'Username:',
            'URL:',
            'Org Type: Scratch Org'
        ]) {
            assert.ok(h.confirmationOutput().includes(expected), '承認入力を求める前に接続先を表示する');
        }
        assert.equal(h.calls.filter((args) => args[0] === 'apex').length, 6);
    });
}

test('取消ではDML・一時ファイルを作成しない', async () => {
    const h = createHarness({ answer: '' });
    assert.equal(await h.run(), 0);
    assert.equal(h.calls.length, 2);
    assert.ok(h.promptClosed());
    assert.ok(h.isClean());
});

test('投入成功後に全件を再照会し、一時ファイルを削除する', async () => {
    const h = createHarness();
    assert.equal(await h.run(), 0);
    assert.ok(h.promptClosed());
    assert.ok(h.isClean());
    assert.equal(h.calls.filter((args) => args[0] === 'apex').length, 6);
    assert.equal(h.calls.filter((args) => args[0] === 'data').length, 5);
});

test('Apexの失敗時に成功を返さず、一時ファイルを削除する', async () => {
    const h = createHarness({ apexFailure: true });
    assert.equal(await h.run(), 1);
    assert.ok(h.isClean());
    assert.equal(h.calls.filter((args) => args[0] === 'data').length, 3);
});

test('検証だけの実行では確認入力・DMLを行わない', async () => {
    const h = createHarness();
    assert.equal(await h.run(['--verify']), 0);
    assert.ok(!h.calls.some((args) => args[0] === 'apex'));
    assert.equal(h.promptClosed(), false);
});

test('CLIが一部の行だけを返した場合と保存内容が違う場合は照合失敗', async () => {
    assert.equal(await createHarness({ incomplete: true }).run(['--verify']), 1);
    assert.equal(await createHarness({ mismatch: true }).run(['--verify']), 1);
    assert.throws(() => queryRecords('SELECT Id FROM Organization', 'test-org', () => ({ status: 1 })), /失敗/);
});

test('接続先指定・確認省略・重複・同時モードを拒否する', () => {
    for (const argv of [
        ['--alias', 'test-org'],
        ['--target-org', 'test-org'],
        ['--yes'],
        ['--dry-run', '--verify'],
        ['--verify', '--verify'],
        ['--dry-run', '--dry-run']
    ]) {
        assert.throws(() => parseArgs(argv));
    }
    assert.deepEqual(parseArgs([]), { dryRun: false, verify: false });
});

for (const configResult of [[], [{ success: true, value: '' }], [{ success: false, value: 'test-org' }]]) {
    test(`target-orgを確定できなければ組織照会も投入も行わない: ${JSON.stringify(configResult)}`, async () => {
        const h = createHarness({ configResult });
        assert.equal(await h.run(), 1);
        assert.equal(h.calls.length, 1);
        assert.equal(h.calls[0][0], 'config');
        assert.equal(h.confirmationCount(), 0);
        assert.ok(h.isClean());
    });
}

test('helpではtarget-orgの取得も組織接続も行わない', async () => {
    const h = createHarness();
    assert.equal(await h.run(['--help']), 0);
    assert.deepEqual(h.calls, []);
});

// CLIが非0終了してもApexの具体的な理由を隠さない。
test('コンパイル・実行・通信のエラーを成功として扱わない', () => {
    assert.throws(
        () =>
            readApexResult({
                status: 1,
                stdout: JSON.stringify({ status: 1, data: { compileProblem: 'コンパイル理由' } })
            }),
        /コンパイル理由/
    );
    assert.throws(
        () => readApexResult(ok({ success: false, compiled: true, exceptionMessage: '実行理由' })),
        /実行理由/
    );
    assert.throws(() => readApexResult({ status: 0, stdout: 'not-json' }), /JSON/);
    assert.throws(() => readApexResult({ status: null, stdout: '{}', error: new Error('通信理由') }), /通信理由/);
});

test('API名は部署・課の英語名とし、旧名は移行用だけに保持する', () => {
    assert.ok(plan.roles.every((row) => !row.key.startsWith('OrgExplorerTest')));
    assert.equal(plan.roles.find((row) => row.name === '営業部').key, 'SalesDepartment');
    assert.equal(plan.roles.find((row) => row.name === '営業部 法人営業課').key, 'CorporateSalesSection');
    assert.equal(plan.roles.find((row) => row.name === '総務部 福利厚生課').key, 'EmployeeBenefitsSection');
    const previousKeys = plan.roles.map((row) => row.previousKey).filter((key) => key !== null);
    assert.equal(new Set(previousKeys).size, previousKeys.length);
    assert.equal(plan.roles.find((row) => row.key === 'InternationalSalesSection').previousKey, null);
    const fresh = structuredClone(plan);
    fresh.roles.forEach((row) => {
        row.previousKey = null;
    });
    assert.equal(validatePlan(fresh).roles.length, plan.roles.length);
});

test('Scratch Org準備から渡された接続先を再判定し、default target-orgは照会しない', async () => {
    const h = createHarness();
    assert.equal(await h.run([], 'test-org'), 0);
    assert.equal(h.calls[0][0], 'org');
    assert.ok(!h.calls.some((args) => args[0] === 'config'));
    assert.equal(h.confirmationCount(), 1);
});

for (const type of ['production', 'sandbox', 'developer']) {
    test(`内部指定でも${type}へのロール・ユーザー作成を拒否する`, async () => {
        const h = createHarness({ type });
        assert.equal(await h.run([], 'test-org'), 1);
        assert.equal(h.calls.length, 1);
        assert.equal(h.calls[0][0], 'org');
        assert.equal(h.confirmationCount(), 0);
    });
}

test('再実行は既存の名称・役職・上司を維持し、不足分だけ定義と照合する', () => {
    const data = recordsFromPlan();
    data.roles[0].Name = '変更済み会社名';
    data.users[0].Title = '変更済み役職';
    data.users[1].ManagerId = null;
    data.users[0].EmployeeNumber = null;
    data.users[1].EmployeeNumber = '既存番号';
    const baseline = structuredClone(data);
    baseline.users.pop();
    baseline.roles.pop();
    assert.deepEqual(verifyRecords(plan, data.roles, data.users, baseline), { roles: 39, users: 264 });
    data.users[0].Title = '意図しない更新';
    assert.throws(() => verifyRecords(plan, data.roles, data.users, baseline), /既存ユーザーが変更/);
    data.users[0] = structuredClone(baseline.users[0]);
    data.roles[0].Name = '意図しない更新';
    assert.throws(() => verifyRecords(plan, data.roles, data.users, baseline), /既存ロールが変更/);
});

for (const field of ['roles', 'users']) {
    test(`再実行で既存${field}のIDが変わった場合も検知する`, () => {
        const data = recordsFromPlan();
        const baseline = structuredClone(data);
        data[field][0].Id = 'replaced-record';
        assert.throws(() => verifyRecords(plan, data.roles, data.users, baseline), /変更されています/);
    });
}

test('法人営業課の末端ロールへ203人を割り当て、所属と上司を合わせる', () => {
    const sales = plan.users.filter((row) => row.role === 'CorporateSalesStaff');
    assert.equal(sales.length, 203);
    assert.equal(new Set(sales.map((row) => `${row.LastName} ${row.FirstName}`)).size, 203);
    assert.equal(plan.users.filter((row) => row.role === 'SalesDepartment').length, 1);
    assert.ok(!plan.roles.some((row) => row.parent === 'CorporateSalesStaff'));
    assert.ok(sales.every((row) => row.Title === '担当' && row.Department === '営業部 法人営業課'));
    assert.ok(sales.every((row) => row.manager === 'orgexplorer.seed.2@example.com'));
    assert.equal(new Set(plan.users.map((row) => row.Email)).size, 264);
});

test('全対象を保持した50件以下の要求へ分割し、上司より先に部下を投入しない', () => {
    const sources = buildSources(plan, template, orgId);
    assert.equal(sources.length, 6);
    const emails = new Set();
    for (const source of sources) {
        assert.ok(Buffer.byteLength(source) <= 32768);
        const payload = JSON.parse(Buffer.from(source.match(/base64Decode\('([^']+)'\)/)[1], 'base64').toString());
        assert.equal(payload.userEmailKeys.length, 264);
        assert.ok(payload.users.length <= 50);
        for (const user of payload.users) {
            assert.ok(user[userFields.length + 1] === null || emails.has(user[userFields.length + 1]));
            assert.equal(emails.has(user[3]), false);
            emails.add(user[3]);
        }
    }
    assert.equal(emails.size, 264);
});

test('分割途中の失敗は後続投入と成功表示を止め、一時ファイルを削除する', async () => {
    const h = createHarness({ apexFailureAt: 2 });
    assert.equal(await h.run(), 1);
    assert.equal(h.calls.filter((args) => args[0] === 'apex').length, 2);
    assert.ok(h.isClean());
    assert.ok(!h.output.join('').includes('処理成功'));
});

test('再実行の集計はロールや既存ユーザーを分割回数で重複計上しない', async () => {
    const h = createHarness();
    assert.equal(await h.run(), 0);
    assert.ok(h.output.join('').includes('rolesCreated=0 rolesSkipped=39 usersCreated=0 usersSkipped=264'));
});

test('分割合成の入口で不正定義と要求サイズ超過を拒否する', () => {
    assert.throws(() => buildSources({ ...plan, unexpected: true }, template, orgId), /項目/);
    assert.throws(() => buildSources(plan, template + 'x'.repeat(32768), orgId), /32KiB/);
});
