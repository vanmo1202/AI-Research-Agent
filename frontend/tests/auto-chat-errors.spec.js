import { test, expect } from './auth-fixture';
for (const scenario of [
  {
    name: 'Gemini JSON failure after reading sources',
    code: 'GEMINI_INVALID_JSON',
    message: 'Gemini trả dữ liệu không đúng JSON; câu trả lời chưa được lưu.',
    searchStatus: 'sources_ready',
    stage: 'answering',
    status: 'failed',
  },
  {
    name: 'Tavily authentication failure',
    code: 'TAVILY_AUTH_FAILED',
    message: 'Tavily không xác thực được. Quản trị viên cần kiểm tra cấu hình tìm kiếm.',
    searchStatus: 'provider_error',
    stage: 'searching',
    status: 'complete',
  },
  {
    name: 'All sources rejected without provider failure',
    message:
      'Không tìm được nguồn phù hợp. Chưa đủ bằng chứng từ các nguồn đã kiểm tra để trả lời câu hỏi này.',
    searchStatus: 'filtered_out',
    stage: 'complete',
    status: 'complete',
  },
]) {
  test(`${scenario.name}: honest persisted status and no automatic POST retry`, async ({
    page,
    request,
  }) => {
    const created = await request.post('http://localhost:4300/api/chats', {
      data: { mode: 'auto' },
    });
    expect(created.status()).toBe(201);
    const { data: session } = await created.json();
    let posts = 0,
      submitted = false;
    const detail = { code: scenario.code, message: scenario.message, stage: scenario.stage };
    await page.route(`**/api/chats/${session.id}/messages`, async (route) => {
      if (route.request().method() === 'POST') {
        posts++;
        submitted = true;
        return route.fulfill({
          status: scenario.status === 'failed' ? 502 : 201,
          json:
            scenario.status === 'failed'
              ? {
                  success: false,
                  error: scenario.message,
                  code: scenario.code,
                  stage: scenario.stage,
                }
              : { success: true, data: {} },
        });
      }
      return route.fulfill({
        json: {
          success: true,
          data: submitted
            ? [
                {
                  id: 'test-question',
                  position: 1,
                  role: 'user',
                  content: 'độ phức tạp thuật toán',
                  status: 'complete',
                  turn_id: 'test-turn',
                  citations: [],
                },
                {
                  id: 'test-answer',
                  position: 2,
                  role: 'assistant',
                  content: scenario.message,
                  status: scenario.status,
                  turn_id: 'test-turn',
                  citations: [],
                  research: {
                    mode: 'auto',
                    searched: scenario.searchStatus !== 'provider_error',
                    searchStatus: scenario.searchStatus,
                    stage: scenario.status === 'failed' ? 'failed' : 'complete',
                    failedStage: scenario.stage,
                    ...(scenario.status === 'failed' ? { error: detail } : {}),
                    searchFailures: scenario.searchStatus === 'provider_error' ? [detail] : [],
                    warnings:
                      scenario.searchStatus === 'filtered_out' ? ['NO_RELEVANT_WEB_SOURCES'] : [],
                  },
                },
              ]
            : [],
        },
      });
    });
    await page.goto(`/chat/${session.id}`);
    await page.getByLabel('Câu hỏi', { exact: true }).fill('độ phức tạp thuật toán');
    await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
    await expect(page.getByText(scenario.message, { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('Đã tìm Internet và kiểm tra nội dung nguồn.', { exact: true }),
    ).toHaveCount(0);
    if (scenario.status === 'failed')
      await expect(page.getByText(/Mã lỗi: GEMINI_INVALID_JSON/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mở nguồn', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Làm mới hội thoại', exact: true }).click();
    await page.reload();
    await expect(page.getByText(scenario.message, { exact: true }).first()).toBeVisible();
    expect(posts).toBe(1);
  });
}
