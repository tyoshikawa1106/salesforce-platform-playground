import { createElement } from 'lwc';
import AccountPdfExport from 'c/accountPdfExport';

const ACCOUNT_RECORD_ID = '001000000000001AAA';
const GENERATED_PDF_URL = 'https://www.example.com';

const createComponent = () => {
    const element = createElement('c-account-pdf-export', {
        is: AccountPdfExport
    });
    element.recordId = ACCOUNT_RECORD_ID;
    document.body.appendChild(element);
    return element;
};

describe('c-account-pdf-export', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.restoreAllMocks();
    });

    it('generates the Visualforce URL and opens it in a new tab', async () => {
        const element = createComponent();
        const openWindow = jest
            .spyOn(window, 'open')
            .mockImplementation(() => null);

        await element.invoke();

        expect(openWindow).toHaveBeenCalledWith(
            GENERATED_PDF_URL,
            '_blank',
            'noopener,noreferrer'
        );
    });

    it('shows an error toast when the record ID is missing', async () => {
        const element = createComponent();
        element.recordId = undefined;
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        const openWindow = jest
            .spyOn(window, 'open')
            .mockImplementation(() => null);

        await element.invoke();

        expect(openWindow).not.toHaveBeenCalled();
        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail).toEqual({
            title: 'PDFを出力できません',
            message:
                '取引先レコードを確認できませんでした。ページを再読み込みしてください。',
            variant: 'error'
        });
    });

    it('shows an error toast when the record ID belongs to another object', async () => {
        const element = createComponent();
        element.recordId = '003000000000001AAA';
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);

        await element.invoke();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail.variant).toBe('error');
    });

    it('prevents concurrent execution while the PDF URL is being generated', async () => {
        const element = createComponent();
        const openWindow = jest
            .spyOn(window, 'open')
            .mockImplementation(() => null);

        const firstInvocation = element.invoke();
        const secondInvocation = element.invoke();

        await firstInvocation;
        await secondInvocation;
        expect(openWindow).toHaveBeenCalledTimes(1);
    });

    it('shows an error toast when opening the PDF fails', async () => {
        const element = createComponent();
        const toastHandler = jest.fn();
        element.addEventListener('lightning__showtoast', toastHandler);
        jest.spyOn(window, 'open').mockImplementation(() => {
            throw new Error('window open failed');
        });

        await element.invoke();

        expect(toastHandler).toHaveBeenCalledTimes(1);
        expect(toastHandler.mock.calls[0][0].detail).toEqual({
            title: 'PDFを出力できません',
            message:
                'PDFを開けませんでした。時間をおいてもう一度お試しください。',
            variant: 'error'
        });
    });

    it('allows execution again after the previous invocation finishes', async () => {
        const element = createComponent();
        const openWindow = jest
            .spyOn(window, 'open')
            .mockImplementation(() => null);

        await element.invoke();
        await element.invoke();

        expect(openWindow).toHaveBeenCalledTimes(2);
    });
});
