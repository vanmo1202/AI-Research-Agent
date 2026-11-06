import { test, expect } from './auth-fixture';
test('Dashboard uses one summary endpoint, handles failure/retry, and preserves error instead of false empty state', async ({
  page,
}) => {
  let failing = true;
  let attempts = 0,
    memories = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/memories')) memories++;
  });
  await page.route('**/api/dashboard', (route) => {
    attempts++;
    return route.fulfill({
      status: failing ? 503 : 200,
      json: failing
        ? { success: false, error: 'Không thể tải tổng quan.' }
        : {
            success: true,
            data: {
              researchCount: 2,
              completedCount: 1,
              documentCount: 201,
              verifiedMemoryCount: 75,
              recentResearch: [],
            },
          },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Không thể tải tổng quan.');
  await expect(page.getByRole('heading', { name: 'Chưa có nghiên cứu gần đây' })).toHaveCount(0);
  const beforeRetry = attempts;
  failing = false;
  await page.getByRole('button', { name: 'Tải lại tổng quan' }).click();
  await expect(page.getByRole('region', { name: 'Thống kê tài khoản' })).toContainText('201');
  await expect(page.getByRole('region', { name: 'Thống kê tài khoản' })).toContainText('75');
  expect(memories).toBe(0);
  expect(attempts).toBe(beforeRetry + 1);
});
