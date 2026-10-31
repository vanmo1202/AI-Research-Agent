const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
test("v2 n8n workflows are wired, bounded, credential-based and webhook-driven", () => {
  const folder = path.join(__dirname, "../../n8n/workflows/v2"),
    files = fs.readdirSync(folder).filter((f) => f.endsWith(".json"));
  assert.equal(files.length, 7);
  for (const file of files) {
    const workflow = JSON.parse(
        fs.readFileSync(path.join(folder, file), "utf8"),
      ),
      names = new Set(workflow.nodes.map((n) => n.name));
    assert.equal(names.size, workflow.nodes.length);
    assert.ok(workflow.nodes.some((n) => n.type.endsWith(".webhook")));
    assert.ok(!workflow.nodes.some((n) => n.type.endsWith(".manualTrigger")));
    for (const [name, c] of Object.entries(workflow.connections)) {
      assert.ok(names.has(name));
      for (const output of c.main)
        for (const edge of output) assert.ok(names.has(edge.node));
    }
    for (const n of workflow.nodes.filter((n) =>
      n.type.endsWith(".httpRequest"),
    )) {
      assert.ok(n.parameters.options.timeout <= 30000);
      assert.ok(workflow.connections[n.name].main[1]?.length);
      if (n.parameters.url.includes("/internal/"))
        assert.equal(n.parameters.genericAuthType, "httpHeaderAuth");
    }
    if (file !== "create-run.json") {
      for (const type of ["wait", "if", "switch"])
        assert.ok(workflow.nodes.some((n) => n.type.endsWith("." + type)));
      assert.ok(
        workflow.nodes.some((n) => n.parameters.jsCode?.includes("count>=240")),
      );
    }
  }
});
