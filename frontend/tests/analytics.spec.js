import { test, expect } from '@playwright/test';
for (const width of [375, 768, 1440]) {
  test(`analytics empty state and filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const requests = [];
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      expect(url.pathname).not.toContain('/internal/');
      if (url.pathname === '/api/analytics') requests.push(url.searchParams.get('range'));
      const data =
        url.pathname === '/api/auth/me'
          ? { id: 'test', name: 'Researcher', email: 'test@example.test' }
          : {
              summary: { research: 0, completed: 0, documents: 0, validSources: null },
              timeline: [],
              statuses: [],
              volume: [],
              pdf: [],
              citations: [],
            };
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/activity');
    await expect(page.getByRole('heading', { name: 'Thống kê nghiên cứu' })).toBeVisible();
    await expect(page.getByText('—', { exact: true })).toBeVisible();
    await expect(page.getByText('Chưa có dữ liệu trong khoảng thời gian này.')).toHaveCount(5);
    await page.getByRole('button', { name: '7 ngày', exact: true }).click();
    await expect.poll(() => requests.includes('7')).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('malformed analytics reports an error and refresh recovers without crashing', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let malformed = true;
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === '/api/auth/me'
        ? { id: 'test', name: 'Researcher', email: 'test@example.test' }
        : path === '/api/analytics' && !malformed
          ? {
              summary: { research: 2, completed: 1, documents: 0, validSources: null },
              timeline: [],
              statuses: [],
              volume: [],
              pdf: [],
              citations: [],
            }
          : [];
    return route.fulfill({ json: { success: true, data } });
  });
  await page.goto('/activity');
  await expect(page.getByRole('alert')).toContainText('Dữ liệu thống kê không hợp lệ');
  expect(errors).toEqual([]);
  malformed = false;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.locator('.ref-metric').filter({ hasText: 'Tổng nghiên cứu' }).locator('strong'),
  ).toHaveText('2');
});
