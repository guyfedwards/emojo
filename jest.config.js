module.exports = {
  // Indicates whether each individual test should be reported during the run.
  verbose: false,

  noStackTrace: true,

  // The directory where Jest should output its coverage files.
  coverageDirectory: './.coverage/',

  // The paths to modules that run some code to configure or set up the testing
  // environment before each test.
  setupFiles: ['<rootDir>/jest.setup.js'],
};
