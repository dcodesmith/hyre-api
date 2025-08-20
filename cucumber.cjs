module.exports = {
  default: {
    requireModule: ["tsconfig-paths/register", "ts-node/register"],
    require: ["test/step-definitions/**/*.ts", "test/support/**/*.ts"],
    format: [
      "progress",
      "json:test/reports/cucumber-report.json",
      "html:test/reports/cucumber-report.html",
    ],
    formatOptions: { snippetInterface: "async-await" },
    paths: ["test/features/**/*.feature"],
    parallel: 1,
    tags: "not @skip",
  },
  booking: {
    requireModule: ["tsconfig-paths/register", "ts-node/register"],
    require: ["test/step-definitions/**/*.ts", "test/support/**/*.ts"],
    format: ["progress"],
    formatOptions: { snippetInterface: "async-await" },
    paths: ["test/features/booking/**/*.feature"],
    tags: "@booking",
  },
  user: {
    requireModule: ["tsconfig-paths/register", "ts-node/register"],
    require: [
      "test/step-definitions/user-management/**/*.ts",
      "test/step-definitions/shared/**/*.ts",
      "test/step-definitions/hooks.ts",
      "test/support/**/*.ts",
    ],
    format: ["progress"],
    formatOptions: { snippetInterface: "async-await" },
    paths: ["test/features/user-management/**/*.feature"],
    tags: "@user-management",
  },
};
