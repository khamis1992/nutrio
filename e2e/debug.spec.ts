import { test } from '@playwright/test';

test('bare minimum', async ({ page }) => {
  await page.goto('http://localhost:5173/nutrio/auth');
  await page.waitForTimeout(8000);
  const title = await page.title();
  console.log('TITLE:', title);
  const url = page.url();
  console.log('URL:', url);
  const html = await page.content();
  console.log('HTML LEN:', html.length);
  console.log('HTML:', html.substring(0, 1000));
});
