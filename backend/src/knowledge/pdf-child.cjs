// Separate bounded process: parsing cannot block HTTP or the research worker event loop.
const fs = require("node:fs/promises");
(async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(await fs.readFile(process.argv[2])),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: true,
    useWorkerFetch: false,
    verbosity: 0,
    maxImageSize: 1,
    isOffscreenCanvasSupported: false,
  });
  let pdf;
  try {
    pdf = await task.promise;
    if ((await pdf.getPermissions()) !== null)
      throw Object.assign(new Error(), { code: "ENCRYPTED_PDF" });
    if (pdf.numPages > Number(process.argv[3]))
      throw Object.assign(new Error(), { code: "PAGE_LIMIT" });
    const pages = [];
    let total = 0;
    for (let page = 1; page <= pdf.numPages; page++) {
      const p = await pdf.getPage(page);
      const content = await p.getTextContent();
      const text = content.items
        .map((i) => i.str || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      total += text.length;
      if (text.length > 200000 || total > 2000000)
        throw Object.assign(new Error(), { code: "TEXT_LIMIT" });
      pages.push({ page, content: text });
      p.cleanup();
    }
    if (total < 20) throw Object.assign(new Error(), { code: "OCR_REQUIRED" });
    process.send({ pages });
  } finally {
    await task.destroy();
  }
})()
  .catch((error) =>
    process.send({
      error:
        error.name === "PasswordException"
          ? "ENCRYPTED_PDF"
          : error.code || "INVALID_PDF",
    }),
  )
  .finally(() => process.disconnect());
