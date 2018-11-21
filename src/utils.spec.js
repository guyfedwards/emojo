const axios = require('axios');
const sharp = require('sharp');
const { Readable } = require('stream');
const Gifsicle = require('gifsicle-stream');
const { streamingDownload, getResizer } = require('./utils');

jest.mock('axios');

let value = {
  data: new Readable(),
};

let url = 'https://emjo.jo';

axios.mockReturnValue(value);

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

    streamingDownload(url);

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
    const download = streamingDownload(url);
    expect(download).resolves.toEqual(value.data);
  });
});

describe('getResizer', () => {
  it('returns Gifsicle instance when mimetype === image/gif', () => {
    // in theory we trust Gifsicle to do it's job as long as we configure
    // it correctly, hence the check for the correct args being passed in...
    const resizer = getResizer('image/gif');

    expect(resizer).toBeInstanceOf(Gifsicle);
    expect(resizer.args).toEqual(
      expect.arrayContaining(['--resize-fit', '128'])
    );
  });

  ['image/jpg', 'imgage/jpeg', 'image/png'].forEach(mime => {
    it(`returns Sharp instance when mimetype is ${mime}`, () => {
      const resizer = getResizer(mime);
      expect(resizer).toBeInstanceOf(sharp);
    });
  });
});
