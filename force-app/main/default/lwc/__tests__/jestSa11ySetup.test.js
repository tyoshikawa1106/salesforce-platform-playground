describe('@sa11y/jest setup', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('provides the toBeAccessible matcher', async () => {
        const button = document.createElement('button');
        button.textContent = 'Save';
        document.body.appendChild(button);

        await expect(button).toBeAccessible();
    });
});
