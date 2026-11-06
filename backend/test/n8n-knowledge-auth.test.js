const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
test("Knowledge chat workflow uses authenticated internal API, projects safe fields and never forwards cookies", () => {
  const flow = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "../../n8n/workflows/knowledge/research-chat-orchestrator.json",
      ),
      "utf8",
    ),
  );
  const http = flow.nodes.find((n) => n.name === "Backend state");
  assert.match(http.parameters.url, /\/internal\/knowledge\/chats\//);
  assert.equal(http.parameters.genericAuthType, "httpHeaderAuth");
  assert.equal(http.retryOnFail, false);
  assert.ok(http.credentials.httpHeaderAuth);
  assert.ok(!JSON.stringify(flow).includes("X-Workspace-Key"));
  assert.ok(!JSON.stringify(flow).toLowerCase().includes("cookie"));
  const validate = new Function(
    "$json",
    flow.nodes.find((n) => n.name === "Validate").parameters.jsCode,
  );
  const body = {
    requestId: "11111111-1111-1111-1111-111111111111",
    chatId: "22222222-2222-2222-2222-222222222222",
    content: "Question",
    clientToken: "turn",
    userId: "spoof",
    ownerId: "spoof",
  };
  assert.deepEqual(validate({ body })[0].json, {
    requestId: body.requestId,
    chatId: body.chatId,
    content: "Question",
    clientToken: "turn",
  });
  assert.throws(() => validate({ body: { ...body, requestId: "" } }));
  assert.equal(
    flow.nodes.find((n) => n.name === "Webhook").parameters.authentication,
    "headerAuth",
  );
});
