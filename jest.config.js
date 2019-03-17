const fs = require('fs');
const path = require('path');

const packages = fs
  .readdirSync(path.join(process.cwd(), 'packages'))
  .filter(name => !['dev-utils', 'examples', 'documentation'].includes(name));

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testURL: 'http://localhost',
  setupFiles: ['<rootDir>/jest.setup.js'],
  snapshotSerializers: ['enzyme-to-json/serializer'],
  roots: packages.map(name => `<rootDir>/packages/${name}/src`),
  // fixes not being able to see console.log in tests...
  verbose: false,
};