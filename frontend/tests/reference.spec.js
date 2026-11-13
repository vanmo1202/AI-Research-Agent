import { test, expect } from '@playwright/test';
const id = 'req-reference',
  run = 'run-reference';
async function fixture(page) {
  const writes = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      p = new URL(req.url()).pathname;
    if (req.method() !== 'GET')
      writes.push({
        path: p,
        body: req.headers()['content-type']?.includes('application/json')
          ? req.postDataJSON()
          : req.postData(),
        key: req.headers()['idempotency-key'],
      });
    let data = [];
    if (p === '/api/auth/me')
      data = { id: 'user', name: 'Mo van', email: 'mo@example.test', role: 'user' };
    else if (p === '/api/analytics')
      data = {
        summary: { research: 3, completed: 1, documents: 2, validSources: null },
        timeline: [],
        statuses: [],
        volume: [],
        pdf: [],
        citations: [],
      };
    else if (p === '/api/dashboard')
      data = {
        researchCount: 3,
        documentCount: 2,
        completedCount: 1,
        verifiedMemoryCount: 7,
        recentResearch: [],
      };
    else if (p === '/api/research')
      data =
        req.method() === 'POST'
          ? { requestId: id }
          : [
              {
                id,
                topic: 'Tác động của AI đến giáo dục đại học',
                created_at: '2026-11-09T02:00:00Z',
                latestRunId: run,
                runStatus: 'partial',
                status: 'created',
              },
            ];
    else if (p.endsWith('/runs'))
      data = { requestId: id, runId: run, status: 'queued', orchestration: 'backend' };
    else if (p === '/api/documents')
      data = [
        {
          id: 'doc',
          filename: 'Tài liệu năng lượng.pdf',
          status: 'ready',
          created_at: '2026-11-09T01:00:00Z',
          page_count: 12,
        },
      ];
    else if (p === '/api/knowledge/config') data = { maxUploadBytes: 20971520, maxPages: 200 };
    else if (p === '/api/research/schedules')
      data = [
        {
          scheduleId: 'schedule',
          requestId: id,
          enabled: false,
          maxConcurrent: 1,
          options: { language: 'vi', numberOfSources: 12 },
        },
      ];
    else if (p.endsWith('/progress'))
      data = {
        requestId: id,
        runId: run,
        status: 'partial',
        percent: 83,
        currentStage: 'verifying',
        completedStages: ['planning', 'collecting', 'analyzing', 'evaluating', 'composing'],
        sourceCount: 4,
        evidenceCount: 2,
        recentEvents: [],
      };
    else if (p === `/api/research/${id}`)
      data = {
        request: { requestId: id, topic: 'Tác động của AI đến giáo dục đại học' },
        researchQuestions: [],
        searchQueries: [],
      };
    else if (p.endsWith('/evidence')) data = { evidence: [], gaps: [], coverage_status: 'partial' };
    await route.fulfill({ json: { success: true, data } });
  });
  return { writes, errors };
}
test('reference dashboard has four live metrics, five work cards and n8n navigation', async ({
  page,
}) => {
  const { writes, errors } = await fixture(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Chào mừng trở lại, Mo van/ })).toBeVisible();
  await expect(page.locator('.ref-stat')).toHaveCount(4);
  await expect(page.locator('.ref-stat-number')).toHaveText(['3', '2', '1', '7']);
  await expect(page.locator('.ref-workflow-card')).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'Tự động hóa (n8n)', exact: true })).toBeVisible();
  for (const h of [
    'Nghiên cứu gần đây',
    'Không gian tri thức',
    'Hoạt động gần đây',
    'Truy cập nhanh',
  ])
    await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
  expect(errors).toEqual([]);
});
test('global search is a keyboard accessible dialog backed by account data', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Tìm kiếm nghiên cứu, tài liệu, báo cáo' }),
  ).toBeVisible();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Tìm kiếm trong workspace' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('searchbox').fill('năng lượng');
  await expect(dialog.getByRole('link', { name: /Tài liệu năng lượng/ })).toHaveAttribute(
    'href',
    '/documents/doc',
  );
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Tìm kiếm nghiên cứu, tài liệu, báo cáo' }),
  ).toBeFocused();
});
test('quick create dialog uses actual async research and run API', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Nghiên cứu mới', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo phiên nghiên cứu mới' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Chủ đề nghiên cứu').fill('Nghiên cứu mới');
  await dialog.getByLabel('Mục tiêu', { exact: true }).fill('Đánh giá bằng chứng');
  await dialog.getByRole('button', { name: 'Bắt đầu nghiên cứu', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/runs/${run}$`));
  expect(writes.filter((w) => w.path.endsWith('/runs'))).toHaveLength(1);
  expect(writes[0].body.executionMode).toBe('async');
});
test('automation never claims n8n connected or runs a private webhook', async ({ page }) => {
  const { writes } = await fixture(page);
  const internal = [];
  page.on('request', (r) => {
    if (/\/internal|\/webhook/.test(r.url())) internal.push(r.url());
  });
  await page.goto('/automations');
  await expect(page.getByRole('heading', { name: 'Tự động hóa (n8n)', exact: true })).toBeVisible();
  await expect(
    page.getByText('Kết nối n8n: Chưa có dữ liệu xác nhận', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chạy thử' })).toHaveCount(0);
  await expect(page.locator('.ref-technical-workflow')).toHaveCount(5);
  await page.getByRole('button', { name: 'Bật lịch', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].path).toBe('/api/research/schedules/schedule');
  expect(internal).toEqual([]);
});
for (const width of [375, 768, 1440])
  test(`reference visuals fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { errors } = await fixture(page);
    for (const path of [
      '/',
      '/workflows',
      '/researches',
      '/evidence',
      '/reports',
      '/automations',
      '/activity',
      '/help',
      '/documents',
      '/chat',
      '/memories',
      `/research/${id}/runs/${run}`,
    ]) {
      await page.goto(path);
      await expect(page.locator('#main-content')).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      if (path === '/' || path === '/automations')
        await page.screenshot({
          path: `/tmp/researchos-reference-${path === '/' ? 'dashboard' : 'automations'}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
    }
    expect(errors).toEqual([]);
  });

test('PDF drop uploads one multipart file and preserves backend processing state', async ({
  page,
}) => {
  await fixture(page);
  let uploads = 0;
  await page.route('**/api/documents', (r) => {
    if (r.request().method() === 'POST') {
      uploads++;
      expect(r.request().headers()['content-type']).toContain('multipart/form-data');
      return r.fulfill({
        status: 202,
        json: {
          success: true,
          data: { document: { id: 'uploaded', filename: 'dropped.pdf', status: 'pending' } },
        },
      });
    }
    return r.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/documents');
  await expect(page.getByRole('button', { name: 'Tải tài liệu', exact: true })).toBeEnabled();
  const transfer = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.items.add(new File(['%PDF-1.4 body'], 'dropped.pdf', { type: 'application/pdf' }));
    return d;
  });
  await page.locator('.ro-pdf-form').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByText('Đã chọn: dropped.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tải tài liệu', exact: true }).click();
  await expect.poll(() => uploads).toBe(1);
  await expect(
    page.getByText('Đã tải lên. Worker sẽ trích xuất và lập chỉ mục.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem tài liệu vừa tải' })).toHaveAttribute(
    'href',
    '/documents/uploaded',
  );
  await expect(page.getByLabel('Tải PDF', { exact: true })).toHaveValue('');
});
test('rejected multi-file drop clears earlier selection instead of uploading the old file', async ({
  page,
}) => {
  const { writes } = await fixture(page);
  await page.goto('/documents');
  await expect(page.getByRole('button', { name: 'Tải tài liệu', exact: true })).toBeEnabled();
  await page.getByLabel('Tải PDF', { exact: true }).setInputFiles({
    name: 'earlier.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF old'),
  });
  const transfer = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    for (const name of ['first.pdf', 'second.pdf'])
      d.items.add(new File(['%PDF'], name, { type: 'application/pdf' }));
    return d;
  });
  await page.locator('.ro-pdf-form').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByRole('alert')).toContainText('Chọn một PDF cho mỗi lần tải lên.');
  await expect(page.getByLabel('Tải PDF', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Tải tài liệu', exact: true }).click();
  expect(writes).toHaveLength(0);
});

test('schedule dialog shows API failure inside the dialog and closes only on confirmed success', async ({
  page,
}) => {
  await fixture(page);
  let attempts = 0;
  await page.route('**/api/research/schedules', (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { success: true, data: [] } });
    attempts++;
    return r.fulfill(
      attempts === 1
        ? { status: 429, json: { success: false, error: 'Schedule quota exceeded' } }
        : {
            status: 201,
            json: { success: true, data: { scheduleId: 'created', requestId: id, enabled: false } },
          },
    );
  });
  await page.goto('/automations');
  await page.getByRole('button', { name: 'Tạo lịch chạy', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo lịch chạy tự động' });
  await dialog.getByRole('combobox', { name: 'Nghiên cứu', exact: true }).selectOption(id);
  await dialog.getByRole('button', { name: 'Tạo lịch', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Schedule quota exceeded');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Tạo lịch', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText('Đã tạo lịch ở trạng thái tắt. Bật lịch khi automation đã được cấu hình.', {
      exact: true,
    }),
  ).toBeVisible();
});

test('activity retrieval errors are not presented as an empty account history', async ({
  page,
}) => {
  await fixture(page);
  await page.route('**/api/analytics?*', (r) =>
    r.fulfill({ status: 503, json: { success: false, error: 'Analytics unavailable' } }),
  );
  await page.goto('/activity');
  await expect(page.getByRole('alert')).toContainText('Analytics unavailable');
  await expect(page.getByText('Chưa có hoạt động được ghi nhận.', { exact: true })).toHaveCount(0);
});
