const AWS = require('aws-sdk');
const axios = require('axios');
const sharp = require('sharp');
const stream = require('stream');
const crypto = require('crypto');
const Slack = require('slack-node');
const logger = require('./logger');

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
    logger.info('Verification successful');
    return {
      body: JSON.stringify({
        challenge: data.challenge,
      }),
    };
  } else {
    logger.error('Verification failed');
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
  // const writeStream = fs.createWriteStream(tmp);
  const passThroughStream = stream.PassThrough();

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
    response.data.pipe(resizer).pipe(passThroughStream);
  });

  const streamAsPromise = new Promise((resolve, reject) =>
    passThroughStream.on('finish', resolve).on('error', reject)
  );

  return streamAsPromise.then(async () => {
    const s3 = new AWS.S3();

    s3.upload({
      Bucket: process.env.S3_BUCKET,
      Key: tmp,
      Body: passThroughStream,
      // Body: fs.createReadStream(path.resolve(tmp)),
      ContentType: metadata.file.mimetype,
      ACL: 'public-read',
    })
      .promise()
      .then(response => {
        logger.info(`Uploaded to s3: ${tmp}`);
        slackAsPromise('chat.postMessage', {
          channel: '#lambda-test',
          text: 'This is my attempt at the emoji you asked for',
          attachments: JSON.stringify([
            { fallback: tmp, image_url: response.Location },
          ]),
        })
          .then(() => {
            logger.info(`Sent to slack: ${tmp}`);
          })
          .catch(e => {
            logger.error(`Failed to upload to slack: ${tmp}`, e);
          });
      })
      .catch(e => {
        logger.error(`Failed to upload to s3: ${tmp}`);
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
      logger.info('Hit default switch, body.type has no matches');
    }
  }
};
