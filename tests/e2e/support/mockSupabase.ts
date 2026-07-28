import type { Page } from '@playwright/test';

export async function mockLocalSupabase(page: Page): Promise<void> {
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/functions/v1/gsa-ad-delivery')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, ad: null }),
      });
      return;
    }

    if (url.includes('/auth/v1/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: null, session: null }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: url.includes('/rpc/') ? JSON.stringify({}) : JSON.stringify([]),
    });
  });
}

export function capturePageErrors(page: Page): string[] {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}
