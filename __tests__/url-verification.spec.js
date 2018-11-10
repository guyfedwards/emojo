const verify = require('../src/url-verification');
const fixture = require('../__fixtures__/url-verification.json');

describe('URL verification', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns input.challenge as json, in stringified body prop for lambda proxy', () => {
    process.env.VERIFICATION_TOKEN = fixture.token;

    const result = verify(fixture);

    expect(result).toEqual({
      body: JSON.stringify({ challenge: fixture.challenge }),
    });
  });

  it('throws if input.token does not match environment.token', () => {
    try {
      verify(fixture);
    } catch (e) {
      expect(e).toEqual(new Error('Verification failed'));
    }
  });
});
