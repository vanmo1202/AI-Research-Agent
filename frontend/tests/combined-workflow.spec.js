import { test, expect } from './auth-fixture';
const id = 'combined-request';
async function setup(page, status = 'planned') {
  const state = { status, creates: 0, searches: 0 };
  const plan = () => ({
    requestId: id,
    status: state.status,
    researchQuestions: [{ id: 'Q1', question: 'Câu hỏi kiểm thử' }],
    searchQueries: [{ query: 'test query' }],
  });
  await page.route('**/api/research', async (route) => {
    state.creates++;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return route.fulfill({
      status: state.failPlan ? 500 : 201,
      json: state.failPlan
        ? { success: false, error: 'Planner failed' }
        : { success: true, data: plan() },
    });
  });
  await page.route(`**/api/research/${id}`, (route) =>
    state.offline
      ? route.abort()
      : route.fulfill({
          json: {
            success: true,
            data: {
              ...plan(),
              request: {
                requestId: id,
                topic: 'Test topic',
                goal: 'Test goal',
                status: state.status,
              },
            },
          },
        }),
  );
  await page.route(`**/api/research/${id}/sources`, (route) =>
    route.fulfill({ json: { success: true, data: { sources: [], sourceCount: 0 } } }),
  );
  await page.route(`**/api/research/${id}/search`, async (route) => {
    state.searches++;
    state.status = 'searching';
    await new Promise((resolve) => setTimeout(resolve, 500));
    state.status = state.failSearch ? 'failed' : 'collected';
    return route.fulfill({
      status: state.failSearch ? 500 : 200,
      json: state.failSearch
        ? { success: false, error: 'Collector failed' }
        : { success: true, data: { status: 'collected' } },
    });
  });
  return state;
}
async function submit(page) {
  await page.goto('/workflow-1');
  await page.locator('#topic').fill('Test topic');
  await page.locator('#goal').fill('Test goal');
  await page.getByRole('button', { name: 'Bắt đầu nghiên cứu', exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
}
const next = (page) => page.getByRole('link', { name: 'Tiếp tục phân tích bằng chứng' });
test('single submit collects once and refresh never reposts or starts analysis', async ({
  page,
}) => {
  const state = await setup(page);
  let downstream = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/(analyze|report)$/.test(r.url())) downstream++;
  });
  await submit(page);
  await expect(next(page)).toBeVisible();
  expect([state.creates, state.searches]).toEqual([1, 1]);
  await page.reload();
  await expect(next(page)).toBeVisible();
  expect([state.creates, state.searches]).toEqual([1, 1]);
  await next(page).click();
  await expect(page).toHaveURL(`/workflow-3/${id}`);
  expect(downstream).toBe(0);
});
test('planner failure never starts collector', async ({ page }) => {
  const state = await setup(page);
  state.failPlan = true;
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('Planner failed');
  expect(state.searches).toBe(0);
});
test('collector failure preserves plan; only user retries', async ({ page }) => {
  const state = await setup(page);
  state.failSearch = true;
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('Collector failed');
  await expect(page.getByText('Câu hỏi kiểm thử', { exact: true })).toBeVisible();
  await expect(next(page)).toHaveCount(0);
  expect(state.searches).toBe(1);
  state.failSearch = false;
  await page.getByRole('button', { name: 'Thử lại thu thập' }).click();
  await expect(next(page)).toBeVisible();
  expect([state.creates, state.searches]).toEqual([1, 2]);
});
test('refresh searching and legacy URLs only read; old plans never collect automatically', async ({
  page,
}) => {
  const state = await setup(page, 'searching');
  await page.goto(`/research/${id}`);
  await expect(page.getByRole('button', { name: 'Đang tìm kiếm và thu thập...' })).toBeDisabled();
  await page.reload();
  state.status = 'collected';
  await expect(next(page)).toBeVisible();
  for (const url of [`/workflow-2/${id}`, `/research/${id}/sources`]) {
    state.status = 'planned';
    await page.goto(url);
    await expect(page.getByRole('button', { name: 'Bắt đầu tìm kiếm & thu thập' })).toBeEnabled();
  }
  expect([state.creates, state.searches]).toEqual([0, 0]);
});
test('offline preflight or unknown status never sends collector POST', async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/research/${id}`);
  const start = page.getByRole('button', { name: 'Bắt đầu tìm kiếm & thu thập' });
  await expect(start).toBeEnabled();
  await page.waitForLoadState('networkidle');
  state.offline = true;
  await start.click();
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối backend');
  expect(state.searches).toBe(0);
  state.offline = false;
  state.status = 'unknown';
  await page.reload();
  await expect(start).toBeDisabled();
  expect(state.searches).toBe(0);
});

test('lost collector response preserves plan and never automatically reposts', async ({ page }) => {
  const state = await setup(page);
  await page.route(`**/api/research/${id}/search`, (route) => {
    state.searches++;
    state.status = 'searching';
    return route.abort();
  });
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối backend');
  await expect(page.getByText('Câu hỏi kiểm thử', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Đang tìm kiếm và thu thập...' })).toBeDisabled();
  state.status = 'collected';
  await expect(next(page)).toBeVisible();
  expect([state.creates, state.searches]).toEqual([1, 1]);
});
