export function getErrorMessages(errors, fallbackMessage) {
    const normalizedErrors = Array.isArray(errors) ? errors : [errors];
    const messages = [];

    for (const error of normalizedErrors) {
        if (!error) {
            continue;
        }

        if (Array.isArray(error.body)) {
            messages.push(
                error.body.map((bodyError) => bodyError.message).join(', ')
            );
            continue;
        }

        messages.push(error.body?.message ?? error.message ?? fallbackMessage);
    }

    return messages;
}

export function reduceErrors(errors, fallbackMessage) {
    return getErrorMessages(errors, fallbackMessage).join('; ');
}

export function createToastMessage(messages, fallbackMessage) {
    const normalizedMessages = Array.isArray(messages) ? messages : [messages];
    const displayMessages = normalizedMessages.filter((message) =>
        Boolean(message)
    );

    return displayMessages.length > 0
        ? displayMessages.join('\n')
        : fallbackMessage;
}