import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    expect(new URL(r.url()).pathname).not.toMatch(/^\/internal/);
  });
  await page.addInitScript(() => localStorage.clear());
  page.on('close', () => expect(errors).toEqual([]));
});
const requestId = 'req-one',
  runId = 'run-one';
async function mock(page, status = 'partial') {
  const writes = [];
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (req.method() !== 'GET')
      writes.push({ path, body: req.postDataJSON(), key: req.headers()['idempotency-key'] });
    let data = [];
    if (path === '/api/auth/me') data = { id: 'u', name: 'Researcher', email: 'u@example.test' };
    else if (path === '/api/research')
      data =
        req.method() === 'POST'
          ? { requestId }
          : [
              {
                id: requestId,
                topic: 'Nghiên cứu năng lượng',
                status: 'created',
                latestRunId: runId,
                runStatus: status,
              },
            ];
    else if (path.endsWith('/progress'))
      data = {
        requestId,
        runId,
        status,
        currentStage: 'verifying',
        completedStages: ['planning', 'collecting', 'analyzing', 'evaluating', 'composing'],
        percent: 83,
        sourceCount: 0,
        evidenceCount: 0,
        recentEvents: [],
      };
    else if (path.endsWith('/evidence'))
      data = { evidence: [], gaps: ['Thiếu bằng chứng độc lập'], coverage_status: 'partial' };
    else if (path === '/api/research/schedules')
      data =
        req.method() === 'POST'
          ? { scheduleId: 's', requestId, enabled: false }
          : [
              {
                scheduleId: 's',
                requestId,
                enabled: false,
                maxConcurrent: 1,
                options: { language: 'vi', numberOfSources: 12 },
              },
            ];
    else if (path === '/api/dashboard')
      data = {
        researchCount: 1,
        completedCount: 0,
        documentCount: 0,
        verifiedMemoryCount: 0,
        recentResearch: [],
      };
    else if (path.endsWith('/runs'))
      data = { requestId, runId, status: 'queued', orchestration: 'backend' };
    else if (path.endsWith('/retry'))
      return route.fulfill({ status: 503, json: { success: false, error: 'Try again' } });
    else if (path === `/api/research/${requestId}`)
      data = { request: { id: requestId, topic: 'Nghiên cứu năng lượng' }, researchQuestions: [] };
    await route.fulfill({ json: { success: true, data } });
  });
  return writes;
}
test('run URL restores partial and refresh never creates work', async ({ page }) => {
  const writes = await mock(page);
  await page.goto(`/research/${requestId}/runs/${runId}`);
  await expect(page.getByRole('heading', { name: 'Tiến trình nghiên cứu' })).toBeVisible();
  await expect(page.getByText('Hoàn thành một phần', { exact: true })).toBeVisible();
  await expect(page.getByText('Thiếu bằng chứng độc lập', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Sáu giai đoạn nghiên cứu' }).locator('li'),
  ).toHaveCount(6);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Thử lại giai đoạn lỗi' })).toBeVisible();
  expect(writes).toHaveLength(0);
});
test('ambiguous retry keeps its idempotency key', async ({ page }) => {
  const writes = await mock(page);
  await page.goto(`/research/${requestId}/runs/${runId}`);
  await page.getByRole('button', { name: 'Thử lại giai đoạn lỗi' }).click();
  await expect(page.getByRole('alert')).toContainText('Try again');
  await page.getByRole('button', { name: 'Thử lại giai đoạn lỗi' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0].key).toBeTruthy();
  expect(writes[1].key).toBe(writes[0].key);
});
test('schedules use public API and expose unsupported controls honestly', async ({ page }) => {
  const writes = await mock(page);
  await page.goto('/schedules');
  await expect(page.getByRole('heading', { name: 'Lịch nghiên cứu', exact: true })).toBeVisible();
  await expect(page.getByText(/Chưa hỗ trợ.*chu kỳ/)).toBeVisible();
  await page.getByRole('button', { name: 'Bật lịch' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].path).toBe('/api/research/schedules/s');
  expect(writes[0].body).toEqual({ enabled: true });
});
for (const width of [375, 768, 1440])
  test(`workspace fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mock(page);
    for (const path of [
      '/',
      '/workflow-1',
      `/research/${requestId}/runs/${runId}`,
      '/documents',
      '/chat',
      '/memories',
      '/schedules',
    ]) {
      await page.goto(path);
      await expect(page.locator('#main-content')).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      if (path === '/' || path.includes('/runs/'))
        await page.screenshot({
          path: `/tmp/researchos-rebuild-${path === '/' ? 'dashboard' : 'run'}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
    }
  });

test('new research validates and sends async request then one backend-managed run', async ({
  page,
}) => {
  const writes = await mock(page);
  await page.goto('/workflow-1');
  await page.getByRole('button', { name: 'Bắt đầu nghiên cứu', exact: true }).click();
  expect(writes).toHaveLength(0);
  await page.getByLabel('Chủ đề nghiên cứu').fill('Năng lượng Việt Nam');
  await page.getByLabel('Mục tiêu', { exact: true }).fill('Đánh giá các phương án lưu trữ');
  await page.getByLabel('Ngôn ngữ').selectOption('en');
  await page.getByLabel('Số nguồn cần tìm').fill('8');
  await page.getByRole('button', { name: 'Bắt đầu nghiên cứu', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/runs/' + runId));
  expect(writes).toHaveLength(2);
  expect(writes[0].body.executionMode).toBe('async');
  expect(writes[1].body).toMatchObject({
    language: 'en',
    numberOfSources: 8,
    orchestration: 'backend',
  });
  expect(writes[1].key).toBeTruthy();
});
test('running run cancels and completed run offers no retry or cancel', async ({ page }) => {
  const writes = await mock(page, 'running');
  await page.goto(`/research/${requestId}/runs/${runId}`);
  await page.getByRole('button', { name: 'Hủy nghiên cứu' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].path).toBe('/api/research/runs/run-one/cancel');
  await page.route('**/progress', (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          requestId,
          runId,
          status: 'completed',
          percent: 100,
          completedStages: [],
          recentEvents: [],
        },
      },
    }),
  );
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByText('Đã hoàn thành', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hủy nghiên cứu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thử lại giai đoạn lỗi' })).toHaveCount(0);
});
test('401 restores safe return route through login', async ({ page }) => {
  await mock(page);
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 401, json: { success: false, error: 'Expired' } }),
  );
  await page.goto('/schedules');
  await expect(page).toHaveURL(/login/);
  await page.route('**/api/auth/login', (r) =>
    r.fulfill({
      json: { success: true, data: { id: 'u', name: 'User', email: 'u@example.test' } },
    }),
  );
  await page.getByLabel('Email', { exact: true }).fill('u@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/schedules/);
});
test('dashboard errors never invent statistics', async ({ page }) => {
  await mock(page);
  await page.route('**/api/dashboard', (r) =>
    r.fulfill({ status: 503, json: { success: false, error: 'Dashboard unavailable' } }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Dashboard unavailable');
  await expect(
    page.locator('.studio-metric').filter({ hasText: 'Tổng nghiên cứu' }).locator('strong'),
  ).toHaveText('—');
});
test('PDF upload keeps pending status and parsing errors remain visible', async ({ page }) => {
  const writes = await mock(page);
  await page.route('**/api/knowledge/config', (r) =>
    r.fulfill({ json: { success: true, data: { maxUploadBytes: 20971520, maxPages: 200 } } }),
  );
  await page.route('**/api/documents', (r) =>
    r.fulfill({
      json: {
        success: true,
        data:
          r.request().method() === 'POST'
            ? { document: { id: 'doc', filename: 'paper.pdf', status: 'pending' } }
            : [{ id: 'doc', filename: 'paper.pdf', status: 'processing' }],
      },
    }),
  );
  await page.goto('/documents');
  await page.getByLabel('Tải PDF', { exact: true }).setInputFiles({
    name: 'paper.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  await page.getByRole('button', { name: 'Tải tài liệu', exact: true }).click();
  await expect(page.getByText('Đã tải lên.', { exact: false })).toBeVisible();
  await expect(page.getByText('Đang trích xuất & lập chỉ mục', { exact: true })).toBeVisible();
  await expect(page.getByText('Sẵn sàng', { exact: true })).not.toBeVisible();
  await page.route('**/api/documents/doc', (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          id: 'doc',
          filename: 'paper.pdf',
          status: 'failed',
          error_code: 'PDF_PARSE_FAILED',
          error_message: 'Cannot parse PDF',
        },
      },
    }),
  );
  await page.goto('/documents/doc');
  await expect(page.getByRole('button', { name: 'Thử lại lập chỉ mục' })).toBeVisible();
});
test('chat sends one clientToken and renders only backend citations', async ({ page }) => {
  await mock(page);
  let saved = false;
  const turns = [];
  const session = {
    id: 'chat-one',
    title: 'Nguồn năng lượng',
    request_id: requestId,
    scope: 'documents',
    document_ids_json: '["doc"]',
    internet_enabled: 0,
  };
  await page.route('**/api/documents', (r) =>
    r.fulfill({
      json: { success: true, data: [{ id: 'doc', filename: 'Paper.pdf', status: 'ready' }] },
    }),
  );
  await page.route(`**/api/research/${requestId}/chats`, (r) =>
    r.fulfill({ json: { success: true, data: [session] } }),
  );
  await page.route('**/api/chats', (r) => r.fulfill({ json: { success: true, data: [session] } }));
  await page.route('**/api/chats/chat-one', (r) =>
    r.fulfill({ json: { success: true, data: session } }),
  );
  await page.route('**/api/chats/chat-one/messages', (r) => {
    if (r.request().method() === 'POST') {
      turns.push(r.request().postDataJSON());
      saved = true;
      return r.fulfill({ json: { success: true, data: { id: 'answer' } } });
    }
    return r.fulfill({
      json: {
        success: true,
        data: saved
          ? [
              {
                id: 'm',
                position: 1,
                role: 'assistant',
                status: 'complete',
                content: 'Nghiên cứu cần thêm bằng chứng.',
                citations: [
                  {
                    referenceId: 'ref',
                    documentId: 'doc',
                    page: 3,
                    title: 'Paper',
                    quote: 'Nguồn trích dẫn thực tế',
                  },
                ],
              },
            ]
          : [],
      },
    });
  });
  await page.goto('/chat/chat-one');
  await page.getByLabel('Câu hỏi', { exact: true }).fill('Kết luận là gì?');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(page.getByText('Nghiên cứu cần thêm bằng chứng.', { exact: true })).toBeVisible();
  expect(turns).toHaveLength(1);
  expect(turns[0].clientToken).toBeTruthy();
  await expect(page.getByRole('link', { name: 'Mở PDF · Trang 3' })).toHaveAttribute(
    'href',
    '/documents/doc?page=3',
  );
});
test('memory approval is explicit and scopes cross research sharing', async ({ page }) => {
  const writes = await mock(page);
  await page.route('**/api/memories?status=candidate', (r) =>
    r.fulfill({
      json: {
        success: true,
        data: [
          {
            id: 'mem',
            status: 'candidate',
            content: 'Bằng chứng cần kiểm tra',
            kind: 'research',
            request_id: requestId,
            links: [],
          },
        ],
      },
    }),
  );
  await page.goto('/memories');
  await expect(page.getByText('Bằng chứng cần kiểm tra')).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Phê duyệt', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    path: '/api/memories/mem/approve',
    body: { crossResearch: false },
  });
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].path).toBe('/api/memories/mem/reject');
});
test('schedule creation uses supported options and starts disabled', async ({ page }) => {
  const writes = await mock(page);
  await page.goto('/schedules');
  await page.getByRole('combobox', { name: 'Nghiên cứu', exact: true }).selectOption(requestId);
  await page.getByRole('button', { name: 'Tạo lịch', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toMatchObject({
    requestId,
    enabled: false,
    maxConcurrent: 1,
    options: { orchestration: 'backend' },
  });
});
test('failed run creation retries same request and idempotency key', async ({ page }) => {
  const writes = await mock(page);
  let attempts = 0;
  const keys = [];
  await page.route('**/api/research/req-one/runs', (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    attempts++;
    return route.fulfill(
      attempts === 1
        ? { status: 503, json: { success: false, error: 'Run outcome unknown' } }
        : { json: { success: true, data: { requestId, runId, status: 'queued' } } },
    );
  });
  await page.goto('/workflow-1');
  await page.getByLabel('Chủ đề nghiên cứu').fill('Năng lượng');
  await page.getByLabel('Mục tiêu', { exact: true }).fill('Đánh giá lưu trữ');
  await page.getByRole('button', { name: 'Bắt đầu nghiên cứu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Run outcome unknown');
  await page.getByRole('button', { name: 'Thử lại tạo lượt chạy' }).click();
  await expect(page).toHaveURL(/\/runs\/run-one$/);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(writes.filter((w) => w.path === '/api/research')).toHaveLength(1);
});

test('run sources use immutable version fields and chat stays scoped to research', async ({
  page,
}) => {
  await mock(page);
  await page.route('**/api/research/runs/run-one/sources', (r) =>
    r.fulfill({
      json: {
        success: true,
        data: [
          {
            id: 'sv',
            title: 'Nguồn thực tế',
            url: 'https://example.test/paper',
            original_content: 'Trích đoạn nguồn bất biến',
            language: 'en',
            translation_status: 'pending',
            provider: 'tavily',
            collected_at: '2026-11-09T00:00:00Z',
          },
        ],
      },
    }),
  );
  await page.route('**/api/research/runs/run-one/evidence', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          coverage_status: 'partial',
          gaps: [],
          evidence: [
            {
              id: 'evidence-one',
              sourceVersionId: 'sv',
              chunkId: 'chunk-one',
              researchQuestion: 'Nguồn hỗ trợ nhận định nào?',
              evidenceText: 'Nhận định được lưu từ máy chủ',
              originalQuote: 'Trích đoạn nguồn bất biến',
            },
          ],
        },
      },
    }),
  );
  await page.goto(`/research/${requestId}/runs/${runId}`);
  await expect(page.getByText('Trích đoạn nguồn bất biến', { exact: true })).toBeVisible();
  await expect(page.getByText(/tavily.*09\/11\/2026/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hỏi AI về nghiên cứu' })).toHaveAttribute(
    'href',
    `/research/${requestId}/chat`,
  );
  await page.getByRole('button', { name: 'Bằng chứng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nguồn hỗ trợ nhận định nào?' })).toBeVisible();
  await expect(page.getByText('Nhận định được lưu từ máy chủ', { exact: true })).toBeVisible();
  await expect(page.locator('.os-source blockquote')).toHaveText('Trích đoạn nguồn bất biến');
  await expect(page.getByText('Source version: sv · Chunk: chunk-one')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đối chiếu nguồn' })).toHaveAttribute(
    'href',
    'https://example.test/paper',
  );
});
test('session service error offers recovery without treating it as logout', async ({ page }) => {
  await mock(page);
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 503, json: { success: false, error: 'Session unavailable' } }),
  );
  await page.goto('/schedules');
  await expect(
    page.getByRole('heading', { name: 'Chưa thể kiểm tra phiên đăng nhập' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/schedules/);
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ json: { success: true, data: { id: 'u', name: 'User' } } }),
  );
  await page.getByRole('button', { name: 'Thử lại kết nối' }).click();
  await expect(page.getByRole('heading', { name: 'Lịch nghiên cứu', exact: true })).toBeVisible();
});
test('mobile navigation traps focus and Escape restores the menu trigger', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mock(page);
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Điều hướng chính' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đóng menu', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
test('missing schedule API reports unavailable and disables creation', async ({ page }) => {
  await mock(page);
  await page.route('**/api/research/schedules', (r) =>
    r.fulfill({ status: 404, json: { success: false, error: 'Schedule API unavailable' } }),
  );
  await page.goto('/schedules');
  await expect(page.getByRole('alert')).toContainText('Schedule API unavailable');
  await expect(page.getByRole('button', { name: 'Tạo lịch', exact: true })).toBeDisabled();
});
test('report preview preserves verification state and exports through public endpoint', async ({
  page,
}) => {
  await mock(page);
  await page.route('**/api/research/runs/run-one/reports', (r) =>
    r.fulfill({
      json: {
        success: true,
        data: [
          {
            id: 'report-one',
            content: '# Báo cáo có bằng chứng\n\nKết quả cần đối chiếu.',
            status: 'partial',
            citationValidation: { valid: false },
            references: [],
          },
        ],
      },
    }),
  );
  await page.route('**/api/research/reports/report-one/export/pdf', (r) =>
    r.fulfill({
      contentType: 'application/pdf',
      headers: {
        'Content-Disposition': 'attachment; filename="research.pdf"',
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
      body: '%PDF-1.4 mock export',
    }),
  );
  await page.goto(`/research/${requestId}/runs/${runId}`);
  await page.getByRole('button', { name: 'Báo cáo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Báo cáo có bằng chứng' })).toBeVisible();
  await expect(page.getByText(/Trạng thái báo cáo: Hoàn thành một phần/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('research.pdf');
});
test('register validates confirmation before submitting credentials', async ({ page }) => {
  const writes = await mock(page);
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 401, json: { success: false, error: 'Login required' } }),
  );
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Researcher');
  await page.getByLabel('Email', { exact: true }).fill('r@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('password123');
  await page.getByLabel('Xác nhận mật khẩu').fill('different123');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Mật khẩu xác nhận chưa khớp');
  expect(writes).toHaveLength(0);
});
test('WF01 quality gaps and old mock sources never display verified citations', async ({
  page,
}) => {
  await mock(page);
  await page.route('**/progress', (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          requestId,
          runId,
          status: 'partial',
          currentStage: 'verifying',
          completedStages: ['planning', 'collecting', 'analyzing'],
          percent: 50,
          sourceCount: 1,
          evidenceCount: 0,
          stageQuality: { analyzing: 'insufficient' },
          recentEvents: [],
        },
      },
    }),
  );
  await page.route('**/api/research/runs/run-one/sources', (r) =>
    r.fulfill({
      json: {
        success: true,
        data: [
          {
            id: 'old',
            provider: 'mock',
            title: 'Old synthetic source',
            url: 'https://example.com/mock/old',
            original_content: 'Old placeholder',
            sourceStatus: 'mock',
          },
        ],
      },
    }),
  );
  await page.route('**/api/research/runs/run-one/reports', (r) =>
    r.fulfill({
      json: {
        success: true,
        data: [
          {
            id: 'report-old',
            status: 'partial',
            content: '# Partial report',
            references: [],
            citationValidation: { valid: true },
          },
        ],
      },
    }),
  );
  await page.goto(`/research/${requestId}/runs/${runId}`);
  await expect(page.getByText('Chất lượng: Chưa đủ bằng chứng', { exact: true })).toBeVisible();
  await expect(page.getByText(/CẢNH BÁO: Nguồn mô phỏng từ run cũ/)).toBeVisible();
  await page.getByRole('button', { name: 'Báo cáo', exact: true }).click();
  await expect(page.getByText('Trích dẫn đã được máy chủ xác minh.', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText(/Hãy kiểm tra kết quả xác minh trích dẫn/)).toBeVisible();
});
