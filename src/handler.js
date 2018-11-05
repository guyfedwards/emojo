const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const crypto = require('crypto');
const Slack = require('slack-node');

const slack = new Slack(process.env.ACCESS_TOKEN);

const getFileMetadataFromId = id => {
  return new Promise((resolve, reject) => {
    slack.api(
      'files.info',
      {
        file: id,
      },
      (err, response) => {
        err || !response.ok ? reject(err) : resolve(response.file);
      }
    );
  });
};

const verify = data => {
  if (data.token === process.env.VERIFICATION_TOKEN) {
    return {
      body: JSON.stringify({
        challenge: data.challenge,
      }),
    };
  } else {
    throw new Error('verification failed');
  }
};

const handle = async message => {
  /**
    * Get data from message
      - File id
      - Channel so we know where to reply to
    * Get file info from file ID
    * Download the file
    * Determine if we need to resize it. width & height < 128px, & size < 64kb
        dimensions: file.original_w, file.original_h
        size: file.size (bytes by the look of it)
        useful: file.name, file.title (same as name?) file.mimetype file.filetype
          file.channels[]
        urls: file.url_private, file.url_private_download
          there are other URLs for premade thumbnails but none @128px :(
     * Post back to slack
     * Upload to git
  */

  const metadata = await getFileMetadataFromId(message.file_id);

  const tmp = crypto.randomBytes(16).toString('hex');
  const writeStream = fs.createWriteStream(tmp);

  const resizer = sharp().resize(128, 128, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  axios({
    method: 'GET',
    url: metadata.url_private,
    responseType: 'stream',
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    },
  }).then(response => {
    response.data.pipe(resizer).pipe(writeStream);
  });

  const streamAsPromise = new Promise((resolve, reject) =>
    writeStream.on('finish', resolve).on('error', reject)
  );

  return streamAsPromise.then(() => {
    slack.api(
      'chat.postMessage',
      {
        text: 'I did make something, but i am yet to upload it...',
        channel: '#lambda-test',
      },
      function(err, response) {
        if (err) {
          throw err;
        }
        console.log(response);
      }
    );

    return {
      done: true,
    };
  });
};

exports.handler = async (event, context) => {
  const body = JSON.parse(event.body);

  switch (body.type) {
    case 'url_verification': {
      return verify(body);
    }
    case 'event_callback': {
      return handle(body.event);
    }
    default: {
      console.log('default ');
    }
  }
};
