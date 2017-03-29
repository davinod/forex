const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const getSlackEvent = event => ({ slack: JSON.parse(event.body) });

//Keep Slack happy by responding to the event.
const respond = callback => (event) => {
    const response = { statusCode: 200 };
    if (event.slack.type === 'url_verification' ) {
        response.body = event.slack.challenge;
    }
    callback(null, response);
    return event;
};

const verifyToken = (event) => {
    console.log('Verifying token...');
    if (event.slack.token !== process.env.VERIFICATION_TOKEN) {
        throw new Error('InvalidToken');
    }
    console.log('Token ok');
    return event;
};

const getTeam = (event) => {
    console.log('getting team...');
    const params = {
        TableName: process.env.TEAMS_TABLE,
        Key: {
            team_id: event.slack.team_id,
        },
    };
    console.log('dynamodb.get', params);
    return dynamodb.get(params).promise()
        .then(data => Object.assign(event, {team: data.Item }));
};

const checkForMention = (event) => {
    const message = event.slack.event.text;
    const botUserId = event.team.bot.bot_user_id;
    const botUserIsMentioned = new RegExp(`^<@${botUserId}>.*$`);
    console.log('Checking...');
    if (botUserIsMentioned.test(message)) {
        console.log(`Bot ${botUserId} is mentioned in "${message}"`);
        return event;
    }
};

const actionFunctionName = `${process.env.NAMESPACE}-actions`;

const invokeAction = (event) => {
    if (!event) return null;
    console.log(`Invoking ${actionFunctionName} with event`, event);
    return lambda.invoke({
        FunctionName: actionFunctionName,
        InvocationType: 'Event',
        LogType: 'None',
        Payload: JSON.stringify(event),
    }).promise();
};

module.exports.handler = (event, context, callback) =>
    Promise.resolve(event)
        .then(getSlackEvent)
        .then(respond(callback))
        .then(verifyToken)
        .then(getTeam)
        .then(checkForMention)
        .then(invokeAction)
        .catch(callback);