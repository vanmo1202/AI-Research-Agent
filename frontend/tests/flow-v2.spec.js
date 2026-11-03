import { test, expect } from '@playwright/test';

test('Dashboard shows the four-step research workflow without auto-research navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tổng quan dự án nghiên cứu' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lập kế hoạch nghiên cứu', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tìm kiếm & Thu thập', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Phân tích bằng chứng', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tạo báo cáo', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nghiên cứu tự động', exact: true })).toHaveCount(0);
});

test('Deprecated automatic research UI routes show the not-found page', async ({ page }) => {
  await page.goto('/research/new');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  await page.goto('/research/example/runs/example');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
});
