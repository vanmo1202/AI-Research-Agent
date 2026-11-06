import { test as base, expect } from '@playwright/test';
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders({ Origin: 'http://localhost:4173' });
    const response = await context.request.post('http://localhost:4300/api/auth/register', {
      data: {
        email: `test-${crypto.randomUUID()}@example.test`,
        name: 'Browser Researcher',
        password: 'browser-test-password-123',
      },
    });
    expect(response.status()).toBe(201);
    const { data: user } = await response.json();
    await context.addInitScript((id) => {
      window.__testUserId = id;
    }, user.id);
    await use(context);
  },
  request: async ({ context }, use) => {
    await use(context.request);
  },
});
export { expect };
