// 用途: 組織テスト実行スクリプトの確認入力とSalesforce CLI応答を共通化する。

// 確認への回答と質問を順番に記録する。
function createPrompt(answers) {
    let closed = false;
    const questions = [];

    return {
        prompt: {
            async question(message) {
                questions.push(message);
                return answers.shift();
            },
            close() {
                closed = true;
            }
        },
        getQuestions() {
            return questions;
        },
        isClosed() {
            return closed;
        }
    };
}

// Salesforce CLIのJSON成功結果を子プロセスの戻り値形式で作成する。
function createSfResult(result) {
    return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify({ status: 0, result })
    };
}

// Default Target Orgと指定種別の認証済み組織情報を返す。
function createOrgInfoCommand(type = 'sandbox') {
    return (args) => {
        if (args[0] === 'config') {
            return createSfResult([{ name: 'target-org', success: true, value: 'test-org' }]);
        }

        const org = {
            alias: 'test-org',
            instanceUrl: 'https://example.my.salesforce.com',
            isSandbox: type === 'sandbox',
            orgEdition: 'Enterprise Edition',
            orgId: '00D000000000001',
            username: 'user@example.com'
        };

        return createSfResult({
            nonScratchOrgs: [org],
            sandboxes: type === 'sandbox' ? [org] : [],
            scratchOrgs: []
        });
    };
}

module.exports = { createOrgInfoCommand, createPrompt, createSfResult };
