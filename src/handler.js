const fs = require('fs');
const os = require('os');
const path = require('path');
const AWS = require('aws-sdk');
const axios = require('axios');
const sharp = require('sharp');
const crypto = require('crypto');
const octokit = require('@octokit/rest')();
const Gifsicle = require('gifsicle-stream');

const logger = require('./logger');
const { slack } = require('./slack');
const verify = require('./url-verification');
const { fileTypeIsSupported, streamAsPromise } = require('./utils');

const EMOJO_REGEX = /^:(\w+):$/;

const getCorrespondingEmojiMessageFromEvent = async event => {
  const response = await slack('channels.history', {
    channel: event.channel_id,
    count: 10,
  });

  const history = response.messages;
  const message = history.find(
    msg => msg.files && msg.files[0].id === event.file_id
  );

  return (EMOJO_REGEX.exec(message.text) || []).pop();
};

const getResizer = mimetype => {
  return mimetype === 'image/gif'
    ? new Gifsicle(['--resize-fit', '128'])
    : sharp()
        .max()
        .resize(128, 128, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        });
};

const sendPreviewToSlack = async (emojiAlias, metadata, tmpPath) => {
  const s3upload = await uploadToS3(emojiAlias, metadata, tmpPath);

  logger.info(`Uploaded to s3 ${s3upload.Location}`);

  try {
    const response = slack('chat.postMessage', {
      channel: metadata.file.channels.join(','),
      text: 'This is my attempt at the emoji you asked for',
      attachments: JSON.stringify([
        { fallback: s3upload.Location, image_url: s3upload.Location },
      ]),
    });

    logger.info(`Sent to slack: ${s3upload.Location}`);

    return response;
  } catch (e) {
    logger.error(`Failed to upload to slack: ${s3upload.Location}`, e);
  }
};

const uploadToGithub = async (alias, metadata, tmpPath) => {
  octokit.authenticate({
    type: 'token',
    token: process.env.GITHUB_TOKEN,
  });

  const b64 = fs.readFileSync(tmpPath, { encoding: 'base64' });

  // allows full url or just owner/repo
  const [repo, owner] = process.env.GITHUB_REPO.split('/').reverse();
  const branch = process.env.GITHUB_REPO_BRANCH;
  const emojiRepoDir = process.env.GITHUB_REPO_DIR;
  const emojiPath = path.join(
    emojiRepoDir,
    `${alias}.${metadata.file.filetype}`
  );

  try {
    await octokit.repos.createFile({
      owner,
      repo,
      path: emojiPath,
      branch,
      message: `emojo: added :${alias}:`,
      content: b64,
    });

    logger.info(
      `Created ${alias}.${metadata.file.filetype} in ${owner}/${repo}`
    );
  } catch (e) {
    logger.error(
      `Error creating file on Github ${owner}/${repo}/${emojiPath}`,
      e
    );
    // @todo: this needs handling as a proper response
  }
};

const downloadImage = url => {
  return axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    },
  });
};

const uploadToS3 = async (key, metadata, tmpPath) => {
  const s3 = new AWS.S3();

  try {
    return s3
      .upload({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        // Body: writeStream,
        Body: fs.createReadStream(tmpPath),
        ContentType: metadata.file.mimetype,
        ACL: 'public-read',
      })
      .promise();
  } catch (e) {
    logger.error(`Failed to upload to s3: ${tmpPath} %s`, e);
  }
};

// const validate = message => {
// does it have a corresponding message and alias?
//  - needs slack api
//  - expected exit, 200. not error
// does the alias clash? - need slack api
//  - unexpected exit 400 bad request.
// is the filetype supported? - needs file metadata
//  - is error because alias found. exit 400 bad request
// };

const handle = async message => {
  message.channel_id = 'CDV5BC8RK'; // '#lambda-test'; @todo remove

  // const validatated = await validate(message);

  const emojiAlias = await getCorrespondingEmojiMessageFromEvent(message);

  if (!emojiAlias) {
    // We need some consistency with how we're exiting
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'No corresponding :alias: message found for this upload',
      }),
    };
  }

  const metadata = await slack('files.info', {
    file: message.file_id,
  });

  try {
    await fileTypeIsSupported(metadata);
  } catch (e) {
    slack('chat.postMessage', {
      channel: message.channel_id,
      text: e.message,
    });

    // rethrow to exit lambda handler
    throw e;
  }

  const tmp = crypto.randomBytes(16).toString('hex');
  const tmpPath = path.resolve(os.tmpdir(), tmp);
  const writeStream = fs.createWriteStream(tmpPath);
  const resizer = getResizer(metadata.file.mimetype);
  const image = await downloadImage(metadata.file.url_private);

  // We can add the other stream here
  image.data.pipe(resizer).pipe(writeStream);

  // We can add the other stream here when we have it w Promise.all
  await streamAsPromise(writeStream);

  // Both of these currently rely on the write to file happening which is why we
  // need to wait for that at the moment. What we can do is pass the stream into
  // uploadToGithub and sendPreviewToSlack and that way we can just have them only
  // resolve when their respective stream has finished and remove the bit above
  await Promise.all([
    sendPreviewToSlack(emojiAlias, metadata, tmpPath),
    uploadToGithub(emojiAlias, metadata, tmpPath),
  ]);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Created a brand new emjoi',
    }),
  };
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
