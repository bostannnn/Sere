function logExecutionStart(arg) {
    const reqId = arg.reqId || '-';
    const endpoint = arg.endpoint || '-';
    const mode = arg.mode || '-';
    const provider = arg.provider || '-';
    const characterId = arg.characterId || '-';
    const chatId = arg.chatId || '-';
    const streaming = arg.streaming ? '1' : '0';
    console.log(
        `[LLMAPI] id=${reqId} event=start endpoint=${endpoint} mode=${mode} provider=${provider} ` +
        `characterId=${characterId} chatId=${chatId} streaming=${streaming}`
    );
}

function logExecutionEnd(arg) {
    const reqId = arg.reqId || '-';
    const endpoint = arg.endpoint || '-';
    const mode = arg.mode || '-';
    const provider = arg.provider || '-';
    const characterId = arg.characterId || '-';
    const chatId = arg.chatId || '-';
    const status = arg.status ?? 500;
    const code = arg.code || '-';
    const durationMs = arg.durationMs ?? 0;
    console.log(
        `[LLMAPI] id=${reqId} event=end endpoint=${endpoint} mode=${mode} provider=${provider} ` +
        `characterId=${characterId} chatId=${chatId} status=${status} code=${code} durationMs=${durationMs}`
    );
}

module.exports = {
    logExecutionStart,
    logExecutionEnd,
};
