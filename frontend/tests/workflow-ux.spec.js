import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const id = '11111111-2222-3333-4444-555555555555';
const source = {
  id: 'source',
  sourceLanguage: 'en',
  translationStatus: 'complete',
  title: 'Original English title',
  titleVi: 'Nguồn tài liệu tiếng Việt',
  snippetVi: 'Tóm tắt tiếng Việt',
  contentVi: 'Nội dung tiếng Việt đã được dịch.',
  url: 'https://example.com/source',
  provider: 'tavily',
};
const item = {
  id: 'evidence',
  sourceId: 'source',
  researchQuestion: 'Cơ chế nào giúp RAG giảm ảo giác?',
  evidenceText: 'Bằng chứng tiếng Việt về nội dung được truy xuất.',
  reason: 'Đoạn văn liên quan đến câu hỏi nghiên cứu.',
  relevanceScore: 0.8044,
  citationLabel: '[Nguồn 1]',
};
async function fixtures(page, state) {
  await page.route(`**/api/research/${id}`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          request: {
            requestId: id,
            topic: 'Ứng dụng RAG',
            goal: 'Đánh giá bằng chứng',
            status: state.status,
          },
          researchQuestions: [{ id: 'Q1', question: item.researchQuestion }],
          searchQueries: [{ questionId: 'Q1', query: 'RAG' }],
        },
      },
    }),
  );
  await page.route(`**/api/research/${id}/sources`, (route) =>
    route.fulfill({ json: { success: true, data: { sources: [source], sourceCount: 1 } } }),
  );
  await page.route(`**/api/research/${id}/evidence`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          status: state.status === 'completed' ? 'analyzed' : state.status,
          partial: state.status === 'analyzed_partial',
          evidence: [item],
          questions: Array.from({ length: 4 }, (_, i) => ({
            questionId: `Q${i + 1}`,
            status: i < 2 ? 'complete' : 'failed',
            ...(i >= 2 ? { error: { message: 'Repeated provider error' } } : {}),
          })),
        },
      },
    }),
  );
  await page.route(`**/api/research/${id}/report`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          title: 'Báo cáo học thuật',
          content:
            '# Báo cáo học thuật\n\n## Giới thiệu\n\nNội dung **quan trọng**.\n\n### Phân tích\n\n- Mục tiếng Việt\n\n1. Bước kiểm tra\n\n> Kết luận thận trọng.\n\n[Liên kết](https://example.com/source)' +
            (state.malicious
              ? '\n\n<script>window.__REPORT_XSS__=true</script>\n\n[unsafe](javascript:alert(1))'
              : ''),
          references: [{ citationLabel: '[Nguồn 1]', title: source.titleVi, url: source.url }],
        },
      },
    }),
  );
}

test('Evidence journey follows backend status and partial alert aggregates counts with real retry action', async ({
  page,
}) => {
  const state = { status: 'analyzed' };
  await fixtures(page, state);
  for (const [status, label, count] of [
    ['analyzed', 'Đã phân tích', '3/4'],
    ['analyzing', 'Đang phân tích', '2/4'],
    ['analyzed_partial', 'Hoàn thành một phần', '2/4'],
    ['failed', 'Phân tích thất bại', '2/4'],
  ]) {
    state.status = status;
    await page.goto(`/workflow-3/${id}`);
    const journey = page.getByRole('region', { name: 'Hành trình nghiên cứu' });
    await expect(journey.getByText(label, { exact: true })).toBeVisible();
    await expect(journey.getByLabel('Số bước đã hoàn thành')).toHaveText(count);
    await expect(page.getByText('Chưa triển khai', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('article').getByRole('heading', { name: item.researchQuestion }),
    ).toBeVisible();
    await expect(page.getByRole('article').getByText('Rất liên quan · 0.8044')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mở nguồn', exact: true })).toHaveAttribute(
      'href',
      source.url,
    );
  }
  state.status = 'analyzed_partial';
  await page.goto(`/workflow-3/${id}`);
  const alert = page.getByRole('status', { name: 'Phân tích hoàn tất một phần' });
  await expect(alert).toContainText('2 câu hỏi đã được phân tích.');
  await expect(alert).toContainText('2 câu hỏi chưa thể xử lý');
  await expect(page.getByText('Repeated provider error', { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/ai-research-evidence-ux.png',
    fullPage: true,
    animations: 'disabled',
  });
  let retried = 0;
  await page.route(`**/api/research/${id}/analyze`, (route) => {
    retried++;
    state.status = 'analyzed';
    return route.fulfill({ json: { success: true, data: { status: 'analyzed' } } });
  });
  await alert.getByRole('button', { name: 'Thử lại các câu hỏi chưa hoàn tất' }).click();
  await expect(alert).toHaveCount(0);
  expect(retried).toBe(1);
});

test('Report renders semantic Markdown, 4/4 journey and export menu; malicious HTML cannot execute', async ({
  page,
}) => {
  const state = { status: 'completed', malicious: false };
  await fixtures(page, state);
  await page.goto(`/workflow-4/${id}`);
  const article = page.getByRole('article', { name: 'Nội dung báo cáo' });
  await expect(article.getByRole('heading', { level: 1, name: 'Báo cáo học thuật' })).toBeVisible();
  await expect(article.getByRole('heading', { level: 2, name: 'Giới thiệu' })).toBeVisible();
  await expect(article.getByRole('heading', { level: 3, name: 'Phân tích' })).toBeVisible();
  await expect(article.locator('strong')).toHaveText('quan trọng');
  await expect(article.locator('ul li')).toHaveText('Mục tiếng Việt');
  await expect(article.locator('ol li')).toHaveText('Bước kiểm tra');
  await expect(article.locator('blockquote')).toContainText('Kết luận thận trọng.');
  await expect(
    page.getByRole('region', { name: 'Hành trình nghiên cứu' }).getByLabel('Số bước đã hoàn thành'),
  ).toHaveText('4/4');
  await page.getByRole('button', { name: 'Xuất báo cáo', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Xuất Word (.docx)' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Xuất PDF (.pdf)' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sao chép báo cáo' })).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/ai-research-report-ux.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  state.malicious = true;
  await page.reload();
  await expect(article.getByRole('heading', { level: 1, name: 'Báo cáo học thuật' })).toBeVisible();
  expect(await page.evaluate(() => window.__REPORT_XSS__)).toBeUndefined();
  await expect(article.locator('a[href^="javascript:"]')).toHaveCount(0);
});

test('Word/PDF download uses actual saved report API, filename, loading and recoverable error', async ({
  page,
  request,
}) => {
  const created = await request.post('http://localhost:4300/api/research', {
    data: { topic: 'Ứng dụng AI', goal: 'Đánh giá lợi ích và hạn chế' },
  });
  const { data } = await created.json();
  expect(
    (await request.post(`http://localhost:4300/api/research/${data.requestId}/search`)).ok(),
  ).toBe(true);
  expect(
    (await request.post(`http://localhost:4300/api/research/${data.requestId}/analyze`)).ok(),
  ).toBe(true);
  expect(
    (
      await request.post(`http://localhost:4300/api/research/${data.requestId}/report`, {
        data: { title: 'Báo cáo kiểm tra xuất file' },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/workflow-4/${data.requestId}`);
  for (const [format, label, signature] of [
    ['docx', 'Word', 'PK'],
    ['pdf', 'PDF', '%PDF-'],
  ]) {
    await page.route(`**/report/export/${format}`, async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Xuất báo cáo', exact: true }).click();
    const response = page.waitForResponse((value) =>
      value.url().endsWith(`/api/research/${data.requestId}/report/export/${format}`),
    );
    const download = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: `Xuất ${label} (.${format})` }).click();
    await expect(
      page.getByRole('button', { name: `Đang tạo file ${label}...`, exact: true }),
    ).toBeDisabled();
    expect((await response).status()).toBe(200);
    const file = await download;
    expect(file.suggestedFilename()).toBe(
      `Bao_cao_nghien_cuu_${data.requestId.slice(0, 8)}.${format}`,
    );
    const bytes = await fs.readFile(await file.path());
    expect(bytes.subarray(0, signature.length).toString()).toBe(signature);
    await expect(page.getByRole('button', { name: 'Xuất báo cáo', exact: true })).toBeEnabled();
  }
  await page.unroute('**/report/export/pdf');
  await page.route('**/report/export/pdf', (route) =>
    route.fulfill({ status: 503, json: { success: false } }),
  );
  await page.getByRole('button', { name: 'Xuất báo cáo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Xuất PDF (.pdf)' }).click();
  await expect(page.getByRole('alert')).toContainText('Không thể xuất báo cáo PDF.');
  await expect(page.getByRole('article', { name: 'Nội dung báo cáo' })).toBeVisible();
});

test('Source detail collapses long Vietnamese content and uses Vietnamese pending/partial notices', async ({
  page,
}) => {
  const state = { status: 'collected' };
  await fixtures(page, state);
  await page.addInitScript((value) => localStorage.setItem('aiResearch:lastRequestId', value), id);
  const previous = { ...source };
  try {
    source.contentVi = 'Nội dung tiếng Việt đã được dịch. '.repeat(60);
    await page.goto('/sources/source');
    const expand = page.getByRole('button', { name: 'Đọc toàn bộ nội dung' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expand.click();
    await expect(page.getByRole('button', { name: 'Thu gọn nội dung' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.getByText(source.title, { exact: true })).toHaveCount(0);
    source.translationStatus = 'pending';
    source.contentVi = null;
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('Đang xử lý bản dịch tiếng Việt...');
    source.translationStatus = 'partial';
    source.contentVi = 'Phần tiếng Việt đã được dịch.';
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('Một phần nội dung chưa thể dịch.');
  } finally {
    Object.assign(source, previous);
  }
});
