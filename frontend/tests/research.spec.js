import { test, expect } from '@playwright/test';

const input = {
  topic: 'Ứng dụng AI trong giáo dục đại học',
  goal: 'Phân tích ứng dụng, lợi ích và thách thức của AI trong giáo dục đại học',
  scope: 'Các nghiên cứu và nguồn web công khai',
};
async function fillResearch(page) {
  await page.getByRole('textbox', { name: 'Chủ đề', exact: true }).fill(input.topic);
  await page.getByRole('textbox', { name: 'Mục tiêu', exact: true }).fill(input.goal);
  await page.getByRole('textbox', { name: 'Phạm vi (tùy chọn)', exact: true }).fill(input.scope);
}
test('Workflow 1 → Workflow 2 → refresh uses actual SQLite API, filters and persistence', async ({
  page,
}) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/workflow-1');
  await expect(page.getByRole('heading', { name: 'Tạo yêu cầu nghiên cứu' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Trung bình/ })).toBeChecked();
  await page.screenshot({
    path: '/tmp/ai-research-workflow1-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await fillResearch(page);
  // Chậm phản hồi thật một chút để kiểm tra nút bị khóa khi gửi POST.
  await page.route('**/api/research', async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({ response });
  });
  const planResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/research') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo Research Plan' }).click();
  await expect(page.getByRole('button', { name: 'Đang tạo kế hoạch...' })).toBeDisabled();
  const response = await planResponse;
  expect(response.status()).toBe(201);
  const { data: plan } = await response.json();
  await expect(page).toHaveURL(new RegExp(`/research/${plan.requestId}$`));
  await expect(page.getByRole('heading', { name: 'Kết quả Research Plan' })).toBeVisible();
  for (const question of plan.researchQuestions)
    await expect(page.getByText(question.question, { exact: true })).toBeVisible();
  for (const query of plan.searchQueries)
    await expect(page.getByText(query.query, { exact: true })).toBeVisible();
  await expect(page.getByText(input.goal, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('aiResearch:lastRequestId'))).toBe(
    plan.requestId,
  );
  await page.reload();
  await expect(page.getByText(plan.researchQuestions[0].question, { exact: true })).toBeVisible();
  await page.screenshot({
    path: '/tmp/ai-research-plan-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  const collectionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/${plan.requestId}/search`) &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Bắt đầu Search & Collect' }).click();
  const collected = await collectionResponse;
  expect(collected.status()).toBe(200);
  const { data: collection } = await collected.json();
  await expect(page).toHaveURL(new RegExp(`/research/${plan.requestId}/sources$`));
  await expect(page.getByRole('heading', { name: 'Kết quả Search & Collect' })).toBeVisible();
  await expect(page.locator('.source-card')).toHaveCount(collection.sourceCount);
  await expect(page.getByText('Đã thu thập', { exact: true })).toBeVisible();
  for (const source of collection.sources)
    await expect(page.getByRole('heading', { name: source.title, exact: true })).toBeVisible();
  const getSources = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/${plan.requestId}/sources`) &&
      response.request().method() === 'GET',
  );
  await page.reload();
  expect((await getSources).status()).toBe(200);
  await expect(page.locator('.source-card')).toHaveCount(collection.sourceCount);
  await page.getByRole('combobox', { name: 'Lọc provider' }).selectOption('mock');
  await expect(page.locator('.source-card')).toHaveCount(collection.sourceCount);
  await page
    .getByRole('textbox', { name: 'Tìm kiếm trong các nguồn đã thu thập', exact: true })
    .fill('no-source-matches-this');
  await expect(page.getByRole('heading', { name: 'Không có nguồn phù hợp' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(page.locator('.source-card')).toHaveCount(collection.sourceCount);
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: '/tmp/ai-research-sources-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  const sourceCard = page.getByRole('article', { name: collection.sources[0].title, exact: true });
  await sourceCard
    .getByRole('button', { name: /Xem chi tiết/ })
    .first()
    .click();
  await expect(sourceCard.locator('.source-detail')).toContainText(collection.sources[0].content);
  const sourceLink = page.locator('.source-card').first().getByRole('link').first();
  await expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
  await page.goto('/');
  await expect(page.getByRole('link', { name: input.topic, exact: true })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click();
  await expect(page.getByText('Backend đang hoạt động', { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Validation, backend 404, network error and empty source state', async ({ page, request }) => {
  await page.goto('/workflow-1');
  await page.getByRole('button', { name: 'Tạo Research Plan' }).click();
  await expect(page).toHaveURL(/workflow-1$/);
  await expect(page.locator('#topic')).toBeFocused();
  await fillResearch(page);
  await page.getByRole('button', { name: 'Xóa nội dung' }).click();
  await expect(page.locator('#topic')).toHaveValue('');
  await expect(page.locator('#goal')).toHaveValue('');
  await page.goto('/research/nonexistent-id');
  await expect(page.getByRole('alert')).toContainText('Research request not found');
  await page.goto('/workflow-1');
  await fillResearch(page);
  await page.route('**/api/research', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Tạo Research Plan' }).click();
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối backend');
  await page.unroute('**/api/research');
  const created = await request.post('http://localhost:4300/api/research', { data: input });
  const { data } = await created.json();
  await page.goto(`/research/${data.requestId}/sources`);
  await expect(page.getByRole('heading', { name: 'Chưa có nguồn tài liệu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bắt đầu Search & Collect' })).toBeEnabled();
});

test('Mobile drawer, responsive form and sources do not overflow', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workflow-1');
  await expect(page.getByRole('navigation')).not.toBeVisible();
  await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng menu', exact: true }).click();
  await fillResearch(page);
  await expect(page.locator('#topic')).toHaveAttribute('maxlength', '200');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: '/tmp/ai-research-workflow1-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  const created = await request.post('http://localhost:4300/api/research', { data: input });
  const { data } = await created.json();
  await request.post(`http://localhost:4300/api/research/${data.requestId}/search`);
  await page.goto(`/research/${data.requestId}/sources`);
  await expect(page.locator('.source-card')).not.toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: '/tmp/ai-research-sources-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('CORS preflight allows only configured browser origin', async ({ request }) => {
  const allowed = await request.fetch('http://localhost:4300/api/research', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:4173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  expect(allowed.status()).toBe(204);
  expect(allowed.headers()['access-control-allow-origin']).toBe('http://localhost:4173');
  const other = await request.get('http://localhost:4300/health', {
    headers: { Origin: 'https://unrelated.example' },
  });
  expect(other.headers()['access-control-allow-origin']).not.toBe('https://unrelated.example');
});

test('Dashboard, source picker, settings, unknown route and tablet navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  for (const [route, heading] of [
    ['/', 'Tổng quan dự án nghiên cứu'],
    ['/sources', 'Nguồn tài liệu của bạn'],
    ['/workflow-2', 'Search & Collect'],
    ['/settings', 'Cài đặt không gian nghiên cứu'],
    ['/unknown-page', 'Không tìm thấy trang'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await expect(page.getByRole('link', { name: 'Workflow 1', exact: true })).toBeVisible();
});
