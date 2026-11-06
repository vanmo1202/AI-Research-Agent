import { test, expect } from './auth-fixture';
test('Auto is default without PDF or Research Plan; web citations persist and Internet can be disabled', async ({
  page,
  request,
}) => {
  let plans = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/research')) plans++;
  });
  await page.goto('/chat');
  await expect(page.getByRole('combobox', { name: 'Chế độ trả lời', exact: true })).toHaveValue(
    'auto',
  );
  await expect(
    page.getByRole('checkbox', { name: 'Tự tìm Internet khi cần (Tavily)', exact: true }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Bắt đầu Auto Chat', exact: true }).click();
  await expect(page).toHaveURL(/\/chat\/[^/?]+$/);
  const chatId = page.url().split('/').at(-1);
  await page.getByLabel('Câu hỏi', { exact: true }).fill('Dijkstra shortest path algorithm');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(page.getByText('Đã tìm Internet và kiểm tra nội dung nguồn.')).toBeVisible();
  await expect(
    page.getByText('Chế độ mô phỏng: đây không phải kết quả nghiên cứu Internet thật.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mở nguồn', exact: true }).first()).toHaveAttribute(
    'href',
    /^https:\/\/example.com\/mock\//,
  );
  const messages = (
    await (await request.get(`http://localhost:4300/api/chats/${chatId}/messages`)).json()
  ).data;
  expect(messages.at(-1).research.usage.search_calls).toBeLessThanOrEqual(2);
  expect(messages.at(-1).research.usage.llm_calls).toBeLessThanOrEqual(3);
  await page
    .getByRole('checkbox', { name: 'Tự tìm Internet khi cần (Tavily)', exact: true })
    .uncheck();
  await expect
    .poll(
      async () =>
        (await (await request.get(`http://localhost:4300/api/chats/${chatId}`)).json()).data
          .internet_enabled,
    )
    .toBe(0);
  await page.getByLabel('Câu hỏi', { exact: true }).fill('A question without any private sources');
  await page.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click();
  await expect(
    page.getByText('Chưa đủ bằng chứng từ các nguồn đã kiểm tra để trả lời câu hỏi này.'),
  ).toBeVisible();
  const latest = (
    await (await request.get(`http://localhost:4300/api/chats/${chatId}/messages`)).json()
  ).data.at(-1);
  expect(latest.research.searched).toBe(false);
  expect(latest.citations).toHaveLength(0);
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: 'Tự tìm Internet khi cần (Tavily)', exact: true }),
  ).not.toBeChecked();
  expect(plans).toBe(0);
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
});
