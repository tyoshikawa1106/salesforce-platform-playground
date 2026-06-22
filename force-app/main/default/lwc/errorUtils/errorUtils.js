export function reduceErrors(errors, fallbackMessage) {
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

    return messages.join('; ');
}
