const common = {
  requireModule: ["ts-node/register"],
  require: ["test/step-definitions/**/*.ts", "test/support/**/*.ts"],
  format: [
    "progress",
    "json:test/reports/cucumber-report.json",
    "html:test/reports/cucumber-report.html",
  ],
  formatOptions: { snippetInterface: "async-await" },
};

module.exports = {
  default: {
    ...common,
    paths: ["test/features/**/*.feature"],
  },
  api: {
    ...common,
    paths: ["test/features/**/*.feature"],
    tags: "@api",
  },
  booking: {
    ...common,
    paths: ["test/features/booking/**/*.feature"],
    tags: "@booking",
  },
};
