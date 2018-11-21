const fs = require('fs');
const AWS = require('aws-sdk');
const Slack = require('slack-node');

const logger = require('./logger');

const instance = new Slack(process.env.ACCESS_TOKEN);

const uploadToS3 = async (key, metadata, tmpPath) => {
  const s3 = new AWS.S3();

  try {
    return s3
      .upload({
        Bucket: process.env.S3_BUCKET,
        Key: `emoji/key`,
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

const slack = (method, params) => {
  return new Promise((resolve, reject) => {
    instance.api(method, params, (err, response) => {
      err || !response.ok
        ? reject(err || new Error(`Response from slack ${response.error}`))
        : resolve(response);
    });
  });
};

// Now that we're checking the file upload has an alias, we could probably revert
// this back to actually uploading a file to the channel rather than sending a
// message with an attachment which would mean we didn't need to upload to s3.
// I haven't removed it in the event that we're keeping all of them for a showcase
// website which we discussed briefly.
exports.sendPreview = async (emojiAlias, metadata, tmpPath) => {
  const s3upload = await uploadToS3(emojiAlias, metadata, tmpPath);

  logger.info(`Uploaded to s3 ${s3upload.Location}`);

  try {
    const response = await slack('chat.postMessage', {
      channel: metadata.file.channels.join(','),
      text: 'This is my attempt at the emoji you asked for',
      attachments: JSON.stringify([
        { fallback: s3upload.Location, image_url: s3upload.Location },
      ]),
    });

    logger.info(`Sent to slack: ${s3upload.Location}`);

    // Needs to resolve a promise because this is used in a promise.all
    return Promise.resolve(response);
  } catch (e) {
    logger.error(`Failed to upload to slack: ${s3upload.Location}`, e);
  }
};

exports.slack = slack;
