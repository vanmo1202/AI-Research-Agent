import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const PDFDocument = require('pdfkit');
const key = 'e2e-knowledge-workspace-private-key';
const headers = { 'X-Workspace-Key': key };
function pdf() {
  return new Promise((resolve) => {
    const p = new PDFDocument(),
      chunks = [];
    p.on('data', (c) => chunks.push(c));
    p.on('end', () => resolve(Buffer.concat(chunks)));
    p.text(
      'Grounded research citations require reliable document evidence and careful validation.',
    );
    p.end();
  });
}
test('real PDF upload/index/chat/citation/memory approval and mobile navigation', async ({
  page,
  request,
}) => {
  const created = await request.post('http://localhost:4300/api/research', {
    data: { topic: 'Grounded research', goal: 'Validate citations from PDF' },
  });
  const { data: plan } = await created.json();
  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'Mở Knowledge Workspace' })).toBeVisible();
  await page.getByLabel('Khóa workspace', { exact: true }).fill(key);
  await page.getByRole('button', { name: 'Mở workspace', exact: true }).click();
  await page
    .getByLabel('Tải PDF', { exact: true })
    .setInputFiles({
      name: 'research-knowledge.pdf',
      mimeType: 'application/pdf',
      buffer: await pdf(),
    });
  await page.getByRole('button', { name: 'Tải tài liệu', exact: true }).click();
  await expect(page.getByText('Đã tải lên. Worker sẽ trích xuất và lập chỉ mục.')).toBeVisible();
  await page.getByRole('link', { name: 'research-knowledge.pdf', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sẵn sàng' })).toBeVisible({
    timeout: 20000,
  });
  await page.getByLabel('Request ID', { exact: true }).fill(plan.requestId);
  await page.getByRole('button', { name: 'Gắn vào nghiên cứu', exact: true }).click();
  await expect(page.getByText('Đã gắn tài liệu vào nghiên cứu.')).toBeVisible();
  await page.getByRole('link', { name: 'Chat với nghiên cứu', exact: true }).last().click();
  await page.getByRole('checkbox', { name: 'research-knowledge.pdf', exact: true }).check();
  await page.getByRole('button', { name: 'Tạo hội thoại', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/research/${plan.requestId}/chat/`));
  await page.getByLabel('Câu hỏi', { exact: true }).fill('Explain grounded research citations');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Mở PDF · Trang 1' })).toBeVisible();
  const citationUrl = await page
    .getByRole('link', { name: 'Mở PDF · Trang 1' })
    .getAttribute('href');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Mở PDF · Trang 1' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Bộ nhớ AI', exact: true }).click();
  await expect(page.locator('.memory-card').getByText('Chờ duyệt', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Cho phép đề xuất dùng ở nghiên cứu khác' }).check();
  await page.getByRole('button', { name: 'Phê duyệt', exact: true }).click();
  await page.getByRole('button', { name: 'Đã xác minh', exact: true }).click();
  await expect(
    page.locator('.memory-card').getByText('Đã xác minh', { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ['/documents', citationUrl, `/research/${plan.requestId}/chat`, '/memories']) {
    await page.goto(url);
    await expect(page.locator('main h1')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
  await page.getByRole('button', { name: 'Khóa workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mở Knowledge Workspace' })).toBeVisible();
  const denied = await request.get('http://localhost:4300/api/documents');
  expect(denied.status()).toBe(401);
  const docs = await request.get('http://localhost:4300/api/documents', { headers });
  expect(docs.ok()).toBe(true);
});
