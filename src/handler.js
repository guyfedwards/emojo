const fs = require('fs');
const url = require('url');
const path = require('path');
const AWS = require('aws-sdk');
const axios = require('axios');
const sharp = require('sharp');
const crypto = require('crypto');
const Slack = require('slack-node');

const slack = new Slack(process.env.ACCESS_TOKEN);

const slackAsPromise = (method, params) => {
  return new Promise((resolve, reject) => {
    slack.api(method, params, (err, response) => {
      err || !response.ok
        ? reject(err || new Error(`Response from slack ${response.error}`))
        : resolve(response);
    });
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
    * Do we have a :alias: or shall we go by filename?
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
     * Delete from disk
  */

  const metadata = await slackAsPromise('files.info', {
    file: message.file_id,
  });

  const tmp = crypto.randomBytes(16).toString('hex');
  const writeStream = fs.createWriteStream(tmp);

  const resizer = sharp()
    .max()
    .resize(128, 128, {
      fit: sharp.fit.inside,
      withoutEnlargement: true,
    });

  axios({
    method: 'GET',
    url: metadata.file.url_private,
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

  return streamAsPromise.then(async () => {
    const s3 = new AWS.S3();

    s3.upload({
      Bucket: process.env.S3_BUCKET,
      Key: tmp,
      Body: fs.createReadStream(path.resolve(tmp)),
      ContentType: metadata.file.mimetype,
      ACL: 'public-read',
    })
      .promise()
      .then(response => {
        slackAsPromise('chat.postMessage', {
          channel: '#lambda-test',
          text: 'This is my attempt at the emoji you asked for',
          attachments: JSON.stringify([
            { fallback: tmp, image_url: response.Location },
          ]),
        });

        fs.unlinkSync(tmp);
      })
      .catch(e => {
        console.log(e);
      });

    // slackAsPromise('files.upload', {
    //   title: 'Image',
    //   filename: 'image.png',
    //   filetype: 'auto',
    //   channels: metadata.file.channels.join(','),
    //   file: fs.createReadStream(path.resolve(tmp)),
    // });

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
