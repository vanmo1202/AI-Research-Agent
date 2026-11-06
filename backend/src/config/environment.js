const path = require("node:path");
const fs = require("node:fs");
const SECRET_NAMES = ["INTERNAL_API_KEY", "GEMINI_API_KEY", "TAVILY_API_KEY"];
function loadSecretFiles(env = process.env) {
  for (const name of SECRET_NAMES) {
    const filename = env[`${name}_FILE`];
    if (!filename) continue;
    if (env[name]) throw new Error(`Conflicting secret sources for ${name}`);
    try {
      const info = fs.statSync(filename);
      if (!info.isFile() || info.size > 8192) throw new Error("Invalid secret file");
      const value = fs.readFileSync(filename, "utf8").trim();
      if (!value) throw new Error("Empty secret");
      env[name] = value;
    } catch {
      throw new Error(`Cannot load secret file for ${name}`);
    }
  }
}
function loadEnvironment() {
  // Test runners and isolated smoke processes must never inherit repository .env secrets.
  if (!(process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === "test" ||
      process.env.RESEARCH_LOAD_ENV === "false")) {
    require("dotenv").config({
      path: path.join(__dirname, "../../.env"),
      quiet: true,
    });
  }
  loadSecretFiles();
}
module.exports = { loadEnvironment, loadSecretFiles };
