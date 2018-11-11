const { handler } = require('../src/handler');
const verify = require('../src/url-verification');
const urlVerificationFixture = require('../__fixtures__/url-verification.json');

jest.mock('../src/url-verification', () => {
  return jest.fn().mockReturnValue('mocked');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Handler', () => {
  it('calls verify when the event type is url_verification', async () => {
    const fixture = {
      type: 'url_verification',
      event: urlVerificationFixture,
    };

    const result = await handler({
      body: JSON.stringify(fixture),
    });

    expect(verify).toBeCalledWith(fixture);
    expect(result).toEqual('mocked');
  });
});
