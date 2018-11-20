const logger = require('./logger');

exports.fileTypeIsSupported = async metadata => {
  const extensions = ['png', 'jpeg', 'jpg', 'gif'];

  if (!extensions.includes(metadata.file.filetype)) {
    const msg = `Unsupported filetype ${metadata.file.filetype}`;

    logger.error(msg);

    throw new Error(msg);
  }
};

exports.streamAsPromise = stream => {
  return new Promise((resolve, reject) =>
    stream.on('finish', resolve).on('error', reject)
  );
};
