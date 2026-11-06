import { test, expect } from './auth-fixture';

test('Dashboard shows the unified research workspace without auto-research navigation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Không chỉ tìm kiếm. Hãy khám phá.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quy trình nghiên cứu', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tìm kiếm & Thu thập', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Bằng chứng', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Báo cáo', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nghiên cứu tự động', exact: true })).toHaveCount(0);
});

test('Unknown research ID and deprecated run URL remain recoverable', async ({ page }) => {
  await page.goto('/research/new');
  await expect(page.getByRole('alert')).toContainText('Resource not found');
  await page.goto('/research/example/runs/example');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
});
