const qs = require('querystring');
const fetch = require('node-fetch');

const log = (event) => {
    console.log('Event', JSON.stringify(event, null, 2));
    return Promise.resolve(event);
};

const parseConvertCommand = (command) => {
    console.log('parsing command "${command}"');
    const pattern = /[a-z\s]*(\d+).*([a-z]{3}).*([a-z]{3})/i;
    const matches = command.match(pattern);
    if (matches) {
        console.log('Parse succeded.');
        return {
            amount: +matches[1],
            source: matches[2],
            target: matches[3],
        };
    }
    console.log('Not possible to parse.');
    return null;
};

const callFixer = (command) => {
    const url = `https://api.fixer.io/latest?base=${command.source}&symbols=${command.target}`;
    console.log(`Requesting ${url}`);
    return fetch(url)
        .then(response => response.json())
        .then((json) => {
            if (json.error === 'Invalid base') {
                return 'No rates found for currency "${command.source}"';
            }
            if (!json.rates[command.target]) {
                return 'No rates found for currency "${command.source}"';
            }
            const result = json.rates[command.target] * command.amount;
            const displayResult = parseFloat(Math.round(result * 100) / 100).toFixed(2);
            return `${command.amount}${command.source} is ${displayResult}${command.target}`;
        });
};

const doCommand = (event) => {
    const rawCommand = event.slack.event.text;
    const command = getCommand(rawCommand);
    const convertCommand = parseConvertCommand(command);
    if (convertCommand) {
        //return convertCommand;
        return callFixer(convertCommand)
            .then(reply => Object.assign(event, { reply }));
    }
    const defaultReply = `I'm sorry, I don't understand the command "${rawCommand}"
Please use a format like "convert 1AUD to USD"`;
    return Object.assign(event, { reply: defaultReply });
};

const getCommand = text => /^<@[A-X0-9]*>(.+)/.exec(text)[1].trim();

const sendResponse = (event) => {
    const params = {
        token: event.team.bot.bot_access_token,
        channel: event.slack.event.channel,
        text: event.reply,
    };
    const url = `https://slack.com/api/chat.postMessage?${qs.stringify(params)}`;
    console.log(`Requesting ${url}`);
    return fetch(url)
        .then(response => response.json())
        .then((response) => {
            if (!response.ok) throw new Error('SlackAPIError');
            return Object.assign(event, { response });
        });
}

module.exports.handler = (event, context, callback) => log(event)
    .then(doCommand) //Attempt the command
    .then(sendResponse) //Update the channel
    .then(() => callback(null)) //Success
    .catch(callback); //Err
