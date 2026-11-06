import { test, expect } from './auth-fixture';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const PDFDocument = require('pdfkit');
function pdf() {
  return new Promise((resolve) => {
    const doc = new PDFDocument(),
      chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.text('Introduction and document index.');
    doc.addPage();
    doc.text(
      'A mass spring system exhibits simple harmonic motion. Hooke law relates the restoring force to displacement. The period depends on mass and stiffness.',
    );
    doc.end();
  });
}
test('PDF → direct chat → page citation → approve memory → explicit recall without a research plan', async ({
  page,
}) => {
  let plans = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/research')) plans++;
  });
  await page.goto('/documents');
  await page
    .getByLabel('Tải PDF', { exact: true })
    .setInputFiles({ name: 'spring-direct.pdf', mimeType: 'application/pdf', buffer: await pdf() });
  await page.getByRole('button', { name: 'Tải tài liệu', exact: true }).click();
  await page.getByRole('link', { name: 'Xem tài liệu vừa tải' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sẵn sàng' })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('link', { name: 'Chat với PDF này', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'spring-direct.pdf', exact: true }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Tạo hội thoại PDF', exact: true }).click();
  await expect(page).toHaveURL(/\/chat\/[^/?]+$/);
  await page.getByLabel('Câu hỏi', { exact: true }).fill('Dao động điều hòa con lắc lò xo');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  const citation = page.getByRole('link', { name: 'Mở PDF · Trang 2', exact: true });
  await expect(citation).toBeVisible();
  await citation.click();
  await expect(page).toHaveURL(/page=2/);
  await expect(
    page
      .getByText('A mass spring system exhibits simple harmonic motion.', { exact: false })
      .first(),
  ).toBeVisible();
  await page.goto('/memories');
  await expect(page.getByText('Hội thoại tài liệu PDF', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Phê duyệt', exact: true }).first().click();
  await page.getByRole('button', { name: 'Đã xác minh', exact: true }).click();
  await page.getByRole('link', { name: 'Dùng trong hội thoại mới', exact: true }).first().click();
  await expect(page.getByLabel('Phạm vi nguồn')).toHaveValue('combined');
  await page.getByRole('checkbox', { name: 'spring-direct.pdf', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Tạo hội thoại PDF', exact: true }).click();
  await page.getByLabel('Câu hỏi', { exact: true }).fill('Explain simple harmonic motion');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.getByText('Đã tái xác minh từ bộ nhớ được chấp nhận')).toBeVisible();
  expect(plans).toBe(0);
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
  await page.reload();
  await expect(page.getByText('Đã tái xác minh từ bộ nhớ được chấp nhận')).toBeVisible();
});
test('Lost chat response is reconciled from history without an automatic POST retry', async ({
  page,
  request,
}) => {
  const upload = await request.post('http://localhost:4300/api/documents', {
    multipart: {
      file: { name: 'lost-response.pdf', mimeType: 'application/pdf', buffer: await pdf() },
    },
  });
  const { data } = await upload.json();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`http://localhost:4300/api/documents/${data.document.id}`)
          ).json()
        ).data.status,
      { timeout: 20000 },
    )
    .toBe('ready');
  const created = await request.post('http://localhost:4300/api/chats', {
    data: { documentIds: [data.document.id] },
  });
  const { data: chat } = await created.json();
  await page.goto(`/chat/${chat.id}`);
  await expect(page.getByLabel('Câu hỏi', { exact: true })).toBeVisible();
  let posts = 0,
    blockReads = false;
  await page.route(`**/api/chats/${chat.id}/messages`, async (route) => {
    if (route.request().method() === 'POST') {
      posts++;
      await route.fetch();
      blockReads = true;
      await route.abort();
    } else if (blockReads) await route.abort();
    else await route.continue();
  });
  await page.getByLabel('Câu hỏi', { exact: true }).fill('simple harmonic motion');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Kiểm tra trạng thái lượt gửi', exact: true }),
  ).toBeVisible();
  expect(posts).toBe(1);
  blockReads = false;
  await page.getByRole('button', { name: 'Kiểm tra trạng thái lượt gửi', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Mở PDF · Trang 2', exact: true })).toBeVisible();
  await expect(page.getByLabel('Câu hỏi', { exact: true })).toHaveValue('');
  expect(posts).toBe(1);
  const messages = (
    await (await request.get(`http://localhost:4300/api/chats/${chat.id}/messages`)).json()
  ).data;
  expect(messages.filter((m) => m.role === 'user')).toHaveLength(1);
});
