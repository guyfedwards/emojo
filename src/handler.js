const https = require('https')
const qs = require('querystring');

const verify = (data, callback) => {
  console.log('verify', process)
  if (data.token === process.env.VERIFICATION_TOKEN) callback(null, data.challenge);
  else callback("verification failed");
}

const handle = (event, callback) => {
  // test the message for a match and not a bot
  if (!event.bot_id && /(emoji)/ig.test(event.text)) {
    var text = `<@${event.user}> isn't AWS Lambda awesome?`;
    var message = {
      token: process.env.ACCESS_TOKEN,
      channel: event.channel,
      text: text
    };

    var query = qs.stringify(message); // prepare the querystring
    https.get(`https://slack.com/api/chat.postMessage?${query}`);
  }

  callback(null);
}

exports.handler = (data, context, callback) => {
  const { body } = data
  const b = JSON.parse(body)
  switch (b.type) {
    case "url_verification": {
      verify(body, callback);
      break;
    }
    case "event_callback": {
      handle(body.event, callback);
      break;
    }
    default: {
      callback(null);
    }
  }
};
