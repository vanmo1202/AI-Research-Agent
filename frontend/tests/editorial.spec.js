import { test, expect } from './auth-fixture';
for (const width of [375, 390, 768, 1024, 1440])
  test(`Editorial shell and real dashboard at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 1000 });
    const result = await request.post('http://localhost:4300/api/research', {
      data: { topic: 'Nghiên cứu từ dữ liệu thật', goal: 'Kiểm tra giao diện với SQLite' },
    });
    expect(result.status()).toBe(201);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hãy khám phá.');
    await expect(page.getByRole('region', { name: 'Thống kê tài khoản' })).toContainText(
      'Nghiên cứu gần đây',
    );
    await expect(page.locator('.studio-metric').first().locator('strong')).toHaveText('1');
    await expect(page.locator('.studio-recent-list')).toContainText('Nghiên cứu từ dữ liệu thật');
    await expect(page.locator('.studio-journey-steps>li')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page.locator('.studio-hero').evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe('rgb(23, 59, 50)');
    if (width <= 900) {
      const toggle = page.getByRole('button', { name: 'Mở menu điều hướng' });
      await toggle.click();
      await expect(page.getByRole('dialog', { name: 'Điều hướng chính' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Đóng menu', exact: true })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(
        page.getByRole('link', { name: 'ResearchOS Không gian nghiên cứu', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
    const account = page.getByLabel('Menu tài khoản');
    await account.click();
    await expect(page.locator('.account-menu')).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('.account-menu')).not.toHaveAttribute('open', '');
    await expect(account).toBeFocused();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('searchbox', { name: 'Tìm kiếm nghiên cứu' })).toBeFocused();
    await page.keyboard.press('Escape');
    await page.screenshot({
      path: `/tmp/researchos-editorial-dashboard-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });

for (const width of [375, 768, 1440])
  test(`Editorial pages retain real workflow and fit ${width}px`, async ({ page, request }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    const created = await request.post('http://localhost:4300/api/research', {
      data: {
        topic: 'Kiểm chứng nguồn tri thức trong nghiên cứu học thuật',
        goal: 'Đánh giá tài liệu và xây dựng lập luận có dẫn chứng',
      },
    });
    expect(created.ok()).toBe(true);
    const { data } = await created.json();
    const id = data.requestId;
    for (const endpoint of ['search', 'analyze', 'report']) {
      const result = await request.post(`http://localhost:4300/api/research/${id}/${endpoint}`, {
        data: {},
      });
      expect(result.ok()).toBe(true);
    }
    const routes = [
      ['workflow', '/workflow-1'],
      ['research', `/research/${id}`],
      ['library', '/documents'],
      ['chat', `/research/${id}/chat`],
      ['memory', '/memories'],
      ['evidence', `/workflow-3/${id}`],
      ['report', `/workflow-4/${id}`],
      ['settings', '/settings'],
    ];
    for (const [name, path] of routes) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name} at ${width}px`,
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/researchos-editorial-${name}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      if (name === 'report') {
        const toc = page.locator('.studio-report-toc');
        await expect(toc).toBeVisible();
        await toc.locator('summary').click();
        await toc.getByRole('link').first().click();
        expect(new URL(page.url()).hash).toContain('section-');
      }
    }
  });
