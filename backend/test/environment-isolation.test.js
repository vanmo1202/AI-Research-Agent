const { test } = require("node:test"),
  assert = require("node:assert/strict");
test("Tests skip dotenv rather than loading repository secrets", (t) => {
  const dotenv = require("dotenv");
  let loaded = 0;
  t.mock.method(dotenv, "config", () => {
    loaded++;
    return { parsed: {} };
  });
  const { loadEnvironment } = require("../src/config/environment");
  loadEnvironment();
  assert.equal(loaded, 0);
  const originalContext = process.env.NODE_TEST_CONTEXT,
    originalEnv = process.env.NODE_ENV,
    originalFlag = process.env.RESEARCH_LOAD_ENV;
  t.after(() => {
    for (const [key, value] of Object.entries({
      NODE_TEST_CONTEXT: originalContext,
      NODE_ENV: originalEnv,
      RESEARCH_LOAD_ENV: originalFlag,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  delete process.env.NODE_TEST_CONTEXT;
  process.env.NODE_ENV = "production";
  process.env.RESEARCH_LOAD_ENV = "false";
  loadEnvironment();
  assert.equal(loaded, 0);
  delete process.env.RESEARCH_LOAD_ENV;
  loadEnvironment();
  assert.equal(loaded, 1);
});
