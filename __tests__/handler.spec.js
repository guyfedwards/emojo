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
  const fixture = {
    type: 'url_verification',
    event: urlVerificationFixture,
  };

  const event = {
    body: JSON.stringify(fixture),
  };

  it('calls verify when the event type is foo', async () => {
    const result = await handler(event);

    expect(verify).toBeCalledWith(fixture);
    expect(result).toEqual('mocked');
  });
});
