const Slack = require('slack-node');
const instance = new Slack(process.env.ACCESS_TOKEN);

exports.slack = (method, params) => {
  return new Promise((resolve, reject) => {
    instance.api(method, params, (err, response) => {
      err || !response.ok
        ? reject(err || new Error(`Response from slack ${response.error}`))
        : resolve(response);
    });
  });
};
