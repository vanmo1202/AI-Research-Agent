import { test, expect } from '@playwright/test';
async function setup(page) {
  const state = {
    chats: [],
    messages: [],
    documents: [],
    writes: [],
    ready: false,
    failNext: false,
  };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (req.method() !== 'GET') state.writes.push(path);
    expect(path).not.toContain('/internal/');
    let data = [];
    if (path === '/api/research') data = [{ id: 'research-one', topic: 'Solar energy efficiency' }];
    else if (path === '/api/research/research-one')
      data = {
        request: {
          id: 'research-one',
          topic: 'Solar energy efficiency',
          goal: 'Explain mechanisms and evidence',
        },
      };
    else if (path === '/api/auth/me')
      data = { id: 'alice', name: 'Alice', email: 'alice@example.test' };
    else if (path === '/api/knowledge/config') data = { maxUploadBytes: 20971520 };
    else if (path === '/api/chats' || path === '/api/research/research-one/chats') {
      if (req.method() === 'POST') {
        state.chats.push({
          id: 'chat-one',
          request_id: 'research-one',
          title: 'Cuộc trò chuyện mới',
          auto_research: 1,
          internet_enabled: 1,
          document_ids_json: JSON.stringify(req.postDataJSON().documentIds || []),
        });
        data = state.chats[0];
      } else data = state.chats;
    } else if (path.endsWith('/messages')) {
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        state.chats[0].title = body.content;
        state.messages.push({
          id: 'u' + state.messages.length,
          position: state.messages.length,
          role: 'user',
          content: body.content,
          status: 'complete',
          turn_id: body.clientToken,
          citations: [],
        });
        data = {
          id: 'a' + state.messages.length,
          position: state.messages.length,
          role: 'assistant',
          content: 'Ví dụ:\n```js\nconst answer = 42;\n```',
          status: 'complete',
          turn_id: body.clientToken,
          citations: [],
        };
        if (state.failNext) {
          state.failNext = false;
          data.status = 'failed';
          data.content = 'Provider unavailable';
          state.messages.push(data);
          await route.fulfill({
            status: 503,
            json: { success: false, error: 'Provider unavailable' },
          });
          return;
        }
        state.messages.push(data);
      } else data = state.messages;
    } else if (path === '/api/research/research-one/documents') data = { attached: true };
    else if (path === '/api/documents') {
      if (req.method() === 'POST') {
        state.documents.push({ id: 'pdf-one', filename: 'notes.pdf', status: 'pending' });
        data = { document: state.documents.at(-1) };
      } else
        data = state.documents.map((d) => ({ ...d, status: state.ready ? 'ready' : d.status }));
    } else if (path.endsWith('/preferences')) {
      state.chats[0].document_ids_json = JSON.stringify(req.postDataJSON().documentIds);
      data = state.chats[0];
    } else if (path === '/api/chats/chat-one') data = state.chats[0];
    await route.fulfill({ json: { success: true, data } });
  });
  return { state, errors };
}
for (const width of [375, 768, 1440])
  test(`chat sends with Enter, renders code and fits ${width}px`, async ({ page }) => {
    const { state, errors } = await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/research/research-one/chat');
    await expect(
      page.getByRole('heading', { name: 'AI Research Chat', exact: true }),
    ).toBeVisible();
    const input = page.getByRole('textbox', { name: 'Câu hỏi' });
    await input.fill('Giải thích React hooks');
    await input.press('Shift+Enter');
    expect(state.writes).toEqual([]);
    await input.press('Enter');
    await expect(page).toHaveURL(/\/research\/research-one\/chat\/chat-one$/);
    await expect(page.locator('pre code')).toContainText('const answer = 42');
    await expect(page.locator('.chat-session-list')).toContainText('Giải thích React hooks');
    expect(state.writes).toEqual([
      '/api/research/research-one/chats',
      '/api/chats/chat-one/messages',
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
test('upload uses document API, attaches pending PDF, disables send until ready', async ({
  page,
}) => {
  const { state, errors } = await setup(page);
  await page.goto('/research/research-one/chat');
  await page.locator('input[type=file]').setInputFiles({
    name: 'notes.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  await expect(page).toHaveURL(/\/research\/research-one\/chat\/chat-one$/);
  await expect(page.locator('.unified-attachments')).toContainText('Đang xử lý');
  await expect(page.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled();
  state.ready = true;
  await expect(page.locator('.unified-attachments')).toContainText('Sẵn sàng', { timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled();
  expect(state.writes).toEqual([
    '/api/research/research-one/chats',
    '/api/documents',
    '/api/research/research-one/documents',
    '/api/chats/chat-one/preferences',
  ]);
  expect(errors).toEqual([]);
});
test('legacy research chat link opens same session and permits continuation', async ({ page }) => {
  const { state, errors } = await setup(page);
  state.chats = [
    {
      id: 'chat-one',
      title: 'Legacy research',
      request_id: 'research-one',
      auto_research: 1,
      internet_enabled: 1,
      document_ids_json: '[]',
    },
  ];
  await page.goto('/research/research-one/chat/chat-one');
  await expect(page.getByRole('textbox', { name: 'Câu hỏi' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Câu hỏi' }).fill('Tiếp tục');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(page.locator('pre code')).toBeVisible();
  expect(state.writes).toEqual(['/api/chats/chat-one/messages']);
  expect(errors).toEqual([]);
});

test('failed initial turn can be retried explicitly', async ({ page }) => {
  const { state, errors } = await setup(page);
  state.failNext = true;
  await page.goto('/research/research-one/chat');
  await page.getByRole('textbox', { name: 'Câu hỏi' }).fill('Explain closures');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(page.getByRole('button', { name: 'Thử lại câu hỏi' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại câu hỏi' }).click();
  await expect(page.locator('pre code')).toBeVisible();
  expect(state.writes.filter((path) => path.endsWith('/messages'))).toHaveLength(2);
  expect(new Set(state.messages.filter((m) => m.role === 'user').map((m) => m.turn_id)).size).toBe(
    2,
  );
  expect(errors).toEqual([]);
});

test('upload preserves PDF selected from the document library', async ({ page }) => {
  const { state } = await setup(page);
  state.documents.push({ id: 'selected-pdf', filename: 'selected.pdf', status: 'ready' });
  await page.goto('/research/research-one/chat?documentId=selected-pdf');
  await expect(page.locator('.unified-attachments')).toContainText('selected.pdf');
  await page.locator('input[type=file]').setInputFiles({
    name: 'notes.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  await expect(page).toHaveURL(/\/research\/research-one\/chat\/chat-one$/);
  expect(JSON.parse(state.chats[0].document_ids_json)).toEqual(['selected-pdf', 'pdf-one']);
  await expect(page.locator('.unified-attachments')).toContainText('selected.pdf');
  await expect(page.locator('.unified-attachments')).toContainText('notes.pdf');
});

test('/chat requires selecting an owned research and creates no standalone chat', async ({
  page,
}) => {
  const { state, errors } = await setup(page);
  await page.goto('/chat');
  await expect(page.getByRole('region', { name: 'Chọn nghiên cứu' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Câu hỏi' })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  await page
    .getByRole('region', { name: 'Chọn nghiên cứu' })
    .getByRole('link', { name: 'Solar energy efficiency' })
    .click();
  await expect(page.getByRole('textbox', { name: 'Câu hỏi' })).toBeVisible();
  expect(errors).toEqual([]);
});
