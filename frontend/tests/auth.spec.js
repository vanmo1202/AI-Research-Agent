import { test, expect } from '@playwright/test';
const javaScriptErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  javaScriptErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(javaScriptErrors.get(page), 'Unexpected uncaught auth JavaScript errors').toEqual([]);
});
for (const width of [375, 768, 1024, 1440])
  test(`Register login refresh logout and private routing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/documents');
    await expect(page).toHaveURL(/login/);
    await page.getByRole('link', { name: 'Đăng ký', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/researchos-register-${width}.png`, fullPage: true });
    const email = `auth-${crypto.randomUUID()}@example.test`;
    await page.getByLabel('Họ và tên', { exact: true }).fill('Nguyễn An');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('my secure password 123');
    await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('my secure password 123');
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    await expect(page).toHaveURL(/documents$/);
    await page.reload();
    await expect(page.getByLabel('Menu tài khoản')).toContainText('Nguyễn An');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByLabel('Menu tài khoản').click();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page).toHaveURL(/login/);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByLabel('Mật khẩu', { exact: true }).fill('my secure password 123');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(/documents$/);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/$/);
  });

test('Accounts on the same browser never share research history', async ({ page, context }) => {
  const headers = { Origin: 'http://localhost:4173' };
  const credentials = {
    name: 'History Alice',
    email: `alice-${crypto.randomUUID()}@example.test`,
    password: 'history-password-123',
  };
  expect(
    (
      await context.request.post('http://localhost:4300/api/auth/register', {
        headers,
        data: credentials,
      })
    ).status(),
  ).toBe(201);
  const response = await context.request.post('http://localhost:4300/api/research', {
    headers,
    data: { topic: 'Private Alice research', goal: 'Personal research' },
  });
  const { data } = await response.json();
  await page.goto(`/research/${data.requestId}`);
  await expect(
    page.getByRole('heading', { name: 'Lập kế hoạch & Thu thập', exact: true, level: 1 }),
  ).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Private Alice research', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Menu tài khoản').click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect(
    (
      await context.request.post('http://localhost:4300/api/auth/register', {
        headers,
        data: {
          ...credentials,
          name: 'History Bob',
          email: `bob-${crypto.randomUUID()}@example.test`,
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/');
  await expect(page.getByLabel('Menu tài khoản')).toContainText('History Bob');
  await expect(page.getByText('Private Alice research', { exact: true })).toHaveCount(0);
  expect(
    (await context.request.get(`http://localhost:4300/api/research/${data.requestId}`)).status(),
  ).toBe(404);
});

test('Six character registration and password change show real Settings; expired session never replays a POST', async ({
  page,
}) => {
  let registrations = 0,
    posts = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST') {
      posts++;
      if (req.url().endsWith('/api/auth/register')) registrations++;
    }
  });
  await page.goto('/register');
  const email = `six-${crypto.randomUUID()}@example.test`;
  await page.getByLabel('Họ và tên', { exact: true }).fill('Six Character User');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('abc12');
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('abc12');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  expect(
    await page.getByLabel('Mật khẩu', { exact: true }).evaluate((input) => input.validity.tooShort),
  ).toBe(true);
  expect(registrations).toBe(0);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('abc123');
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('abc123');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/settings');
  await expect(
    page.getByRole('heading', { name: 'Six Character User', exact: true }),
  ).toBeVisible();
  await expect(page.locator('main').getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByText('Hồ sơ demo', { exact: true })).toHaveCount(0);
  await page.getByLabel('Menu tài khoản').click();
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('abc123');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('xyz789');
  await page.getByRole('button', { name: 'Thay đổi mật khẩu', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã thay đổi mật khẩu');
  const before = posts;
  await page.route('**/api/dashboard', (route) =>
    route.fulfill({ status: 401, json: { success: false, error: 'Phiên đăng nhập đã hết hạn.' } }),
  );
  await page.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', { exact: true }),
  ).toBeVisible();
  expect(posts).toBe(before);
});
