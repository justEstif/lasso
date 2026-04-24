import { test, expect } from '@playwright/test';

test('visual baseline', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveScreenshot('home-page.png');
});