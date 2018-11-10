const logger = require('./logger');

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

module.exports = verify;
