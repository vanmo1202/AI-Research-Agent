const { test } = require("node:test");
const assert = require("node:assert/strict");
const dns = require("node:dns"),
  net = require("node:net"),
  http = require("node:http");

test("Collector pins validated DNS and cannot follow a rebinding answer to loopback", async (t) => {
  let privateHits = 0;
  const connected = [];
  const server = http.createServer((req, res) => {
    privateHits++;
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<p>synthetic-private-service</p>");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const originalDns = dns.lookup;
  t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.mock.method(dns, "lookup", (hostname, options, callback) =>
    originalDns("127.0.0.1", options, callback),
  );
  // Observe socket resolution but never send packets to a public address during this test.
  t.mock.method(net, "connect", (options) => {
    assert.equal(options.host, "audit-rebind.invalid");
    const socket = new net.Socket();
    const lookup = options.lookup || dns.lookup;
    lookup(options.host, { all: false }, (error, address, family) => {
      if (error) return socket.destroy(error);
      connected.push(address);
      if (address === "127.0.0.1")
        socket.connect({ host: address, port: options.port, family });
      else
        process.nextTick(() =>
          socket.destroy(new Error("Public egress disabled by test")),
        );
    });
    return socket;
  });
  const content = require("../src/services/content.service");
  const text = await content.fetchPageContent(
    `http://audit-rebind.invalid:${server.address().port}/`,
  );
  assert.equal(
    privateHits,
    0,
    "Validated public DNS was looked up again and reached a private service",
  );
  assert.deepEqual(connected, ["93.184.216.34"]);
  assert.equal(text, "");
});

test("Collector rechecks redirect DNS and rejects mixed public/private answers", async (t) => {
  const content = require("../src/services/content.service");
  let fetches = 0;
  t.mock.method(dns.promises, "lookup", async (hostname) =>
    hostname === "public.audit.invalid"
      ? [{ address: "93.184.216.34", family: 4 }]
      : [{ address: "127.0.0.1", family: 4 }],
  );
  t.mock.method(global, "fetch", async () => {
    fetches++;
    return new Response(null, {
      status: 302,
      headers: { Location: "http://private.audit.invalid/internal" },
    });
  });
  assert.equal(
    await content.fetchPageContent("http://public.audit.invalid/start"),
    "",
  );
  assert.equal(fetches, 1);
  dns.promises.lookup.mock.mockImplementation(async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ]);
  await assert.rejects(
    content.checkPublicUrl("https://mixed.audit.invalid"),
    /public address/,
  );
  for (const url of [
    "file:///etc/passwd",
    "http://user:pass@public.audit.invalid/",
  ])
    await assert.rejects(content.checkPublicUrl(url), /Invalid page URL/);
});

test("Collector keeps decompressed body limit when using a pinned dispatcher", async (t) => {
  const content = require("../src/services/content.service");
  t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.mock.method(
    global,
    "fetch",
    async () =>
      new Response("x".repeat(2 * 1024 * 1024 + 1), {
        headers: { "Content-Type": "text/html" },
      }),
  );
  assert.equal(
    await content.fetchPageContent("https://public.audit.invalid/large"),
    "",
  );
});
