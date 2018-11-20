const axios = require('axios');
const sharp = require('sharp');
const Gifsicle = require('gifsicle-stream');

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

exports.getResizer = mimetype => {
  return mimetype === 'image/gif'
    ? new Gifsicle(['--resize-fit', '128'])
    : sharp().resize(128, 128, {
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      });
};

exports.downloadAsStream = url => {
  return axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    },
  });
};
