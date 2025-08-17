const tsConfigPaths = require("tsconfig-paths");
const { compilerOptions } = require("./tsconfig.json");

tsConfigPaths.register({
  baseUrl: compilerOptions.baseUrl,
  paths: compilerOptions.paths,
});

// Register ts-node with path mapping
require("ts-node").register({
  project: "./tsconfig.json",
  require: ["tsconfig-paths/register"],
});
