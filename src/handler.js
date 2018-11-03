const https = require('https');
const fetch = require('node-fetch');

const verify = (data, callback) => {
  console.log('verify', data, process.env.VERIFICATION_TOKEN);

  if (data.token === process.env.VERIFICATION_TOKEN) {
    console.log('all good in the hood');
    return {
      body: JSON.stringify({
        challenge: data.challenge,
      }),
    };
  } else {
    throw new Error('verification failed');
  }
};

const handle = async event => {
  console.log('handle', event);
  // get image from files.list

  // resize image

  // add image to git

  // test the message for a match and not a bot
  // if (!event.bot_id && /(emoji)/gi.test(event.text)) {
  //   var text = `<@${event.user}> isn't AWS Lambda awesome?`;
  var message = {
    token: process.env.ACCESS_TOKEN,
    channel: event.channel_id,
    text: 'Fucking idiot!',
  };

  let response;
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    response = await res.json();
    console.log('response', response);
  } catch (e) {
    console.error(e);
    throw new Error(e);
  }

  // var query = qs.stringify(message); // prepare the querystring
  // console.log('query', query);
  // https.get(`https://slack.com/api/chat.postmessage?${query}`);
  // }
};

exports.handler = async (event, context) => {
  const body = JSON.parse(event.body);
  console.log('call me handler', body);

  switch (body.type) {
    case 'url_verification': {
      return verify(body);
      break;
    }
    case 'event_callback': {
      return await handle(body.event);
      break;
    }
    default: {
      console.log('default ');
      // callback(null);
    }
  }
};
