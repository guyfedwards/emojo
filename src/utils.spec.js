const axios = require('axios');
const { downloadAsStream } = require('./utils');

jest.mock('axios');

describe('downloadAsStream', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('sends a request to the url', () => {
    process.env.ACCESS_TOKEN = 'DQ8BAQoFBwUFAQcHBAsNBQ';

    const url = 'https://emjo.jo';
    downloadAsStream(url);

    expect(axios).toBeCalledWith({
      method: 'GET',
      responseType: 'stream',
      url: url,
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      },
    });
  });

  // Check it returns axios' return value. We don't care what that is really
  // because we trust axios to
  //  - return a promise
  //  - return a readable stream inside response.data
  it('returns the result from axios', () => {
    axios.mockResolvedValue('foo');

    const url = 'https://emjo.jo';
    const response = downloadAsStream(url);

    response.then(value => {
      expect(value).toEqual('foo');
    });
  });
});