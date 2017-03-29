const qs = require('querystring');
const AWS = require('aws-sdk');
const fetch = require('node-fetch');

const dynamodb = new AWS.DynamoDB.DocumentClient();

const saveResponse = (response) => {
    const params = {
        TableName: process.env.TEAMS_TABLE,
        Item: response,
    };
    console.log('Put', params);
    return dynamodb.put(params).promise();
};

const getCode = (event) => {
    var code = null;
    if (event.queryStringParameters && event.queryStringParameters.code) {
        code = event.queryStringParameters.code;
    }
    return code;
};

const requestToken = (code) => {
    console.log(`Requesting token with ${code}`);
    if (code === null) { return null; }
    const params = {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
    };
    const url = `https://slack.com/api/oauth.access?${qs.stringify(params)}`;
    console.log(`Fetching ${url}`);
    return fetch(url)
      .then(response => response.json())
      .then((json) => {
        if (json.ok) return json;
        throw new Error('SlackAPIError');
    });
};

const successResponse = callback => callback(null, {
    statusCode: 302,
    headers: { Location: process.env.INSTALL_SUCCESS_URL },
});

const errorResponse = (error, callback) => {
    console.error(error);
    return callback(null, {
        statusCode: 302,
        headers: { Location: process.env.INSTALL_ERROR_URL },
    });
};

module.exports.handler = (event, context, callback) =>
  Promise.resolve(event)
    .then(getCode)
    .then(requestToken)
    .then(saveResponse)
    .then(() => successResponse(callback))
    .catch(error => errorResponse(error, callback));