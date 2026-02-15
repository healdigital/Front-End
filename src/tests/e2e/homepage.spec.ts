import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const disableMotionForA11y = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });
};

test.describe('Homepage E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads homepage and key sections', async ({ page }) => {
    await expect(page).toHaveTitle(/La Cuisine de Bernard/i);
    await expect(page.getByRole('heading', { level: 1, name: /Cuisinez avec passion/i })).toBeVisible();
    await expect(page.locator('[data-recipe-grid]')).toBeVisible();
    await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();
  });

  test('supports full keyboard navigation for main interactions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const menuTrigger = page.locator('[data-menu-trigger]');
    await menuTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-menu-drawer]')).toBeVisible();
    await expect(page.locator('[data-menu-drawer]')).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-menu-drawer]')).toHaveAttribute('aria-hidden', 'true');

    await page.setViewportSize({ width: 1440, height: 900 });
    const filterTrigger = page.locator('[data-filter-trigger]').first();
    await filterTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-filter-menu]').first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-recipe-results]')).toContainText(/\d+ recette/);

    const nextPaginationLink = page.locator('#pagination-nav a[aria-label="Page suivante"]');
    await nextPaginationLink.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#pagination-nav a[aria-label="Page 10"]')).toBeFocused();
  });

  test('submits newsletter form', async ({ page }) => {
    await page.locator('#open-newsletter-footer').click();

    const modal = page.locator('#newsletter-modal');
    await expect(modal).toBeVisible();

    await modal.locator('input[type="email"]').fill('invalid-email');
    await modal.locator('button[type="submit"]').click();
    await expect(modal).toContainText(/adresse email valide/i);

    await modal.locator('input[type="email"]').fill('test@example.com');
    await modal.locator('label:has(input[type="checkbox"])').click();
    await expect(modal.locator('input[type="checkbox"]')).toBeChecked();
    await modal.locator('button[type="submit"]').click();
    await expect(modal.locator('button[type="submit"]')).toContainText(/Inscription|Inscrit/i);
    await expect(modal).toBeHidden({ timeout: 7000 });
  });

  test('filters and searches recipes on homepage', async ({ page }) => {
    await expect(page.locator('[data-recipe-card]')).toHaveCount(6);

    await page.locator('[data-filter-trigger]').first().click();
    await page.locator('[data-filter-item][data-filter-value="salees"]').first().click();
    await expect(page.locator('[data-recipe-card]:not(.hidden)')).toHaveCount(3);

    await page.fill('#recipe-search-input', 'saumon');
    await page.press('#recipe-search-input', 'Enter');

    const visibleCards = page.locator('[data-recipe-card]:not(.hidden)');
    await expect(visibleCards).toHaveCount(1);
    await expect(visibleCards.first()).toContainText(/saumon/i);
  });

  test('handles modal interactions (outside click and escape)', async ({ page }) => {
    await page.locator('#open-newsletter-footer').click();
    const modal = page.locator('#newsletter-modal');
    await expect(modal).toBeVisible();

    await page.mouse.click(8, 8);
    await expect(modal).toBeHidden();

    await page.locator('#open-newsletter-footer').click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('is responsive on mobile, tablet and desktop breakpoints', async ({ page }) => {
    const grid = page.locator('[data-recipe-grid]');

    await page.setViewportSize({ width: 375, height: 800 });
    await expect(page.locator('[data-menu-trigger]')).toBeVisible();
    const mobileColumns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(mobileColumns).toBe(1);

    await page.setViewportSize({ width: 1024, height: 800 });
    const tabletColumns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(tabletColumns).toBe(2);

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopColumns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(desktopColumns).toBe(3);
  });

  test('@a11y has no accessibility violations on homepage', async ({ page }) => {
    await disableMotionForA11y(page);
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('@a11y modal has no accessibility violations', async ({ page }) => {
    await page.locator('#open-newsletter-footer').click();
    await disableMotionForA11y(page);
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
