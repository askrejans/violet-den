module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  // Run sequentially — all tests share a single SQLite DB file on disk
  maxWorkers: 1,
};
