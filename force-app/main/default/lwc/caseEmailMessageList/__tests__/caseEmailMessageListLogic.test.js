import {
    createCardTitle,
    createEmptyPaginationState,
    createInitialPageState,
    createNextPageState
} from '../caseEmailMessageListLogic';

const EMAIL_MESSAGE = {
    Id: '02s000000000001',
    Incoming: true,
    Subject: 'お問い合わせ',
    FromAddress: 'sender@example.com',
    ToAddress: 'support@example.com',
    TextBody: '本文',
    MessageDate: '2026-07-19T00:00:00.000Z'
};

describe('caseEmailMessageListLogic', () => {
    it('メールを表示行へ変換して初期ページ状態を生成する', () => {
        const state = createInitialPageState(
            {
                emailMessages: [EMAIL_MESSAGE],
                nextPageToken: 'next-token'
            },
            2
        );

        expect(state.emailMessages[0]).toEqual(
            expect.objectContaining({
                id: EMAIL_MESSAGE.Id,
                direction: '受信',
                directionIconName: 'utility:email_open',
                subject: 'お問い合わせ',
                fromAddressUrl: 'mailto:sender%40example.com',
                toAddressUrl: 'mailto:support%40example.com'
            })
        );
        expect(state.nextPageToken).toBe('next-token');
        expect(state.hasNextPage).toBe(true);
        expect(state.loadMoreErrorMessage).toBeUndefined();
    });

    it('追加ページを連結して取得範囲を先頭行へ付加する', () => {
        const state = createNextPageState({
            page: {
                emailMessages: [
                    {
                        ...EMAIL_MESSAGE,
                        Id: '02s000000000002',
                        Incoming: false
                    }
                ],
                nextPageToken: undefined
            },
            emailMessages: [{ id: EMAIL_MESSAGE.Id }],
            totalCount: 2
        });

        expect(state.emailMessages).toHaveLength(2);
        expect(state.emailMessages[1]).toEqual(
            expect.objectContaining({
                direction: '送信',
                hasPageSeparator: true,
                pageSeparatorId: 'email-page-separator-2-2',
                pageSeparatorMessage: '2件目から2件目を読み込みました'
            })
        );
        expect(state.hasNextPage).toBe(false);
    });

    it('カードタイトルと未取得ページング状態を生成する', () => {
        expect(createCardTitle({ hasLoaded: true, totalCount: 3 })).toBe(
            'メールログ (3)'
        );
        expect(
            createCardTitle({
                hasLoaded: true,
                errorMessage: 'error',
                totalCount: 3
            })
        ).toBe('メールログ');
        expect(createEmptyPaginationState()).toEqual({
            emailMessages: [],
            hasNextPage: false,
            nextPageToken: undefined
        });
    });
});
