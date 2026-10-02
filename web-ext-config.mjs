// Configuration for web-ext (run, lint, build).
// Files listed here are development files and are not shipped in the extension.
export default {
  sourceDir: ".",
  artifactsDir: "web-ext-artifacts",
  ignoreFiles: [
    "test",
    "docs",
    "package.json",
    "package-lock.json",
    "README.md",
    "web-ext-config.mjs",
    "web-ext-artifacts",
    "tmp",
  ],
};
