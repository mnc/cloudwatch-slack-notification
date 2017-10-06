'use strict';

const url = require('url');
const https = require('https');
const moment = require('moment');

const slackHookUrl = process.env.slackHookUrl;
const slackChannel = process.env.slackChannel;

function postMessage(message, callback) {
    const body = JSON.stringify(message);
    const options = url.parse(slackHookUrl);
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    };

    const postReq = https.request(options, (res) => {
        const chunks = [];
        res.setEncoding('utf8');
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
            if (callback) {
                callback({
                    body: chunks.join(''),
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                });
            }
        });
        return res;
    });

    postReq.write(body);
    postReq.end();
}

function processEvent(event, callback) {
    console.log(`Event Object: JSON.stringify(event)`);
    const message = JSON.parse(event.Records[0].Sns.Message);

    const alarmName = message.AlarmName;
    const newState = message.NewStateValue;
    const oldState = message.OldStateValue;
    const changeTime = message.StateChangeTime;
    const reason = message.NewStateReason;

    const color = newState == 'OK' ? 'good' : 'danger'
    const slackMessage = {
        channel: slackChannel,
        attachments: [
            {
                pretext: '<!channel> An AWS error has occurred!',
                color: color,
                title: alarmName,
                fields: [
                    {
                        title: 'CurrentState',
                        value: newState,
                        short: true
                    },
                    {
                        title: 'OldState',
                        value: oldState,
                        short: true
                    },
                    {
                        title: 'Reason',
                        value: reason
                    },
                    {
                        title: 'DateTime',
                        value: moment(changeTime).utcOffset(9).format('YYYY-MM-DD HH:mm:ss')
                    },
                ],
            }
        ]
    };

    postMessage(slackMessage, (response) => {
        if (response.statusCode < 400) {
            callback(null);
        } else if (response.statusCode < 500) {
            console.error(`Error posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`);
            console.error(`Event Object is: ${JSON.stringify(event)}`);
            callback(null);
        } else {
            console.error(`Event Object is: ${JSON.stringify(event)}`);
            callback(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
        }
    });
}


exports.handler = (event, context, callback) => {
    if (slackHookUrl) {
        processEvent(event, callback);
    } else {
        callback('Hook URL has not been set.');
    }
};
