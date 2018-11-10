const crypto = require('crypto');
const path = require('path');
const os = require('os');
const stream = require('stream');
const AWS = require('aws-sdk');
const axios = require('axios');
const sharp = require('sharp');
const Slack = require('slack-node');
const logger = require('./logger');
const { Base64Encode } = require('base64-stream');
const octokit = require('@octokit/rest')();

const slack = new Slack(process.env.ACCESS_TOKEN);

const EMOJO_REGEX = /^:\w+:$/;

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
    throw new Error('Verification failed');
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

  // TODO: change to message.channel
  const channelId = 'CDV5BC8RK'; // '#lambda-test';

  const metadata = await slackAsPromise('files.info', {
    file: message.file_id,
  });

  const { filetype } = metadata.file;

  if (!['png', 'jpeg', 'jpg'].includes(filetype)) {
    const msg = `Unsupported filetype ${metadata.file.filetype}`;
    logger.error(msg);

    slackAsPromise('chat.postMessage', {
      channel: channelId,
      text: `${msg}. Try jpg, jpeg or png.`,
    });

    throw new Error(msg);
  }

  const msgHistoryResponse = await slackAsPromise('channels.history', {
    channel: channelId,
    count: 10,
  });
  const msgHistory = msgHistoryResponse.messages;

  const emojiMsg = msgHistory.find(msg => msg.files[0].id === message.file_id);

  const isEmojiMsg = EMOJO_REGEX.test(emojiMsg.text);

  if (!isEmojiMsg) {
    return {
      done: true,
    };
  }

  const emojiAlias = emojiMsg.text.replace(/:/g, '');

  const tmp = crypto.randomBytes(16).toString('hex');
  // const writeStream = fs.createWriteStream(tmpPath);
  const resizedStream = new stream.PassThrough();
  const b64Stream = new stream.PassThrough();

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
    response.data.pipe(resizer).pipe(resizedStream);
  });

  let b64Chunks = [];

  resizedStream.pipe(b64Stream);

  b64Stream.pipe(new Base64Encode());

  b64Stream.on('data', chunk => {
    b64Chunks.push(chunk);
  });
  const [owner, repo] = process.env.GITHUB_REPO.split('/');
  const branch = process.env.GITHUB_REPO_BRANCH;
  const emojiRepoDir = process.env.GITHUB_REPO_DIR;
  const emojiPath = path.join(emojiRepoDir, `${emojiAlias}.${filetype}`);

  b64Stream.on('finish', async () => {
    console.log('b64', Buffer.concat(b64Chunks).toString('base64'));
    try {
      await octokit.repos.createFile({
        owner,
        repo,
        path: emojiPath,
        branch,
        message: `emojo: added :${emojiAlias}:`,
        content: Buffer.concat(b64Chunks).toString('base64'),
      });
      logger.info(`Created ${emojiAlias}.${filetype} in ${owner}/${repo}`);
    } catch (e) {
      logger.error(
        `Error creating file on Github ${owner}/${repo}/${emojiPath}`,
        e
      );
    }
  });

  const streamAsPromise = new Promise((resolve, reject) =>
    resizedStream.on('finish', resolve).on('error', reject)
  );

  return streamAsPromise.then(async () => {
    const s3 = new AWS.S3();

    s3.upload({
      Bucket: process.env.S3_BUCKET,
      Key: emojiAlias,
      Body: resizedStream,
      ContentType: metadata.file.mimetype,
      ACL: 'public-read',
    })
      .promise()
      .then(async response => {
        logger.info(`Uploaded to s3 ${response.Location}`);

        slackAsPromise('chat.postMessage', {
          channel: channelId,
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

        octokit.authenticate({
          type: 'token',
          token: process.env.GITHUB_TOKEN,
        });
      })
      .catch(e => {
        logger.error(`Failed to upload to s3: ${tmp} %s`, e);
      });

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
