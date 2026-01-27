export default {
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.js"],
  collectCoverageFrom: ["src/**/*.js", "!src/cli.js"],
  coverageDirectory: "coverage",
  transform: {},
};
