const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const logger = require('./logger');
const verify = require('./url-verification');
const { uploadToGithub } = require('./github');
const { slack, sendPreview } = require('./slack');
const {
  fileTypeIsSupported,
  promisifyStream,
  getResizer,
  streamingDownload,
} = require('./utils');

const EMOJO_REGEX = /^:(\w+):$/;

const getCorrespondingEmojiMessageFromEvent = async event => {
  const response = await slack('conversations.history', {
    channel: event.channel_id,
    count: 10,
  });

  const history = response.messages;
  const message = history.find(
    msg => msg.files && msg.files[0].id === event.file_id
  );

  return message && (EMOJO_REGEX.exec(message.text) || []).pop();
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
  // message.channel_id = 'CDV5BC8RK'; // '#lambda-test'; @todo remove

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
    await fileTypeIsSupported(metadata.file.filetype);
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

  // We can add the other stream here
  (await streamingDownload(metadata.file.url_private))
    .pipe(resizer)
    .pipe(writeStream);

  // We can add the other stream here when we have it w Promise.all
  await promisifyStream(writeStream);

  // Both of these currently rely on the write to file happening which is why we
  // need to wait for that at the moment. What we can do is pass the stream into
  // uploadToGithub and sendPreview and that way we can just have them only
  // resolve when their respective stream has finished and remove the bit above
  await Promise.all([
    sendPreview(emojiAlias, metadata, tmpPath),
    uploadToGithub(emojiAlias, metadata, tmpPath),
  ]).catch(e => {
    logger.error(e);
    throw e;
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Created a brand new emoji',
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
