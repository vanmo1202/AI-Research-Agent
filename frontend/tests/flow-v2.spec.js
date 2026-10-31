import { test, expect } from '@playwright/test';
test('create v2, reload progress, terminal polling stops and server dashboard persists', async ({
  page,
}) => {
  await page.goto('/research/new');
  await page.getByRole('textbox', { name: 'Chủ đề', exact: true }).fill('Nghiên cứu an toàn AI');
  await page.getByRole('textbox', { name: 'Mục tiêu', exact: true }).fill('Tổng hợp bằng chứng');
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: 'Bắt đầu nghiên cứu', exact: true }).click();
  await expect(page).toHaveURL(/\/research\/[^/]+\/runs\/[^/]+/);
  await page.reload();
  await expect(page.getByRole('heading', { name: /partial · verifying/ })).toBeVisible({
    timeout: 20000,
  });
  let calls = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/progress')) calls++;
  });
  await page.waitForTimeout(2500);
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Báo cáo', exact: true }).click();
  await expect(
    page.getByText(
      'Báo cáo chưa đủ bằng chứng hoặc có lỗi trích dẫn. Hãy xem giới hạn nghiên cứu.',
    ),
  ).toBeVisible();
  await page.screenshot({ path: '/tmp/flow-v2-report.png', fullPage: true });
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Nghiên cứu an toàn AI', exact: true }),
  ).toBeVisible();
});
test('connection failure has bounded retries and explicit reconnect', async ({ page }) => {
  await page.route('**/runs/*/progress', (route) => route.abort());
  await page.goto('/research/unknown/runs/unknown');
  await expect(page.getByRole('alert').filter({ hasText: 'Mất kết nối backend' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kết nối lại' })).toBeVisible();
});
