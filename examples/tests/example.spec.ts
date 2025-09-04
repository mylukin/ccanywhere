import { test, expect } from '@playwright/test';

/**
 * Example test file for CCanywhere
 * Place your test files in the tests directory
 */

test.describe('Homepage Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the base URL before each test
    await page.goto('/');
  });

  test('should display the homepage', async ({ page }) => {
    // Check if the page title contains expected text
    await expect(page).toHaveTitle(/Home|Welcome/);
    
    // Check if main content is visible
    const mainContent = page.locator('main, #main, .main');
    await expect(mainContent).toBeVisible();
  });

  test('should have working navigation', async ({ page }) => {
    // Check if navigation exists
    const nav = page.locator('nav, .nav, .navigation');
    await expect(nav).toBeVisible();
    
    // Check for navigation links
    const links = nav.locator('a');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);
  });

  test('should be responsive', async ({ page, viewport }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileMenu = page.locator('[data-mobile-menu], .mobile-menu, .hamburger');
    const isMobileMenuVisible = await mobileMenu.isVisible().catch(() => false);
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    const desktopNav = page.locator('nav:not(.mobile-nav)');
    const isDesktopNavVisible = await desktopNav.isVisible().catch(() => false);
    
    // At least one navigation should be visible
    expect(isMobileMenuVisible || isDesktopNavVisible).toBeTruthy();
  });

  test('should load without console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that no console errors occurred
    expect(errors).toHaveLength(0);
  });

  test('should have proper meta tags', async ({ page }) => {
    // Check for essential meta tags
    const description = await page.getAttribute('meta[name="description"]', 'content');
    expect(description).toBeTruthy();
    
    const viewport = await page.getAttribute('meta[name="viewport"]', 'content');
    expect(viewport).toContain('width=device-width');
    
    // Check for Open Graph tags (optional but recommended)
    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
    const hasOgTags = ogTitle !== null;
    
    if (hasOgTags) {
      expect(ogTitle).toBeTruthy();
    }
  });
});

test.describe('Performance Tests', () => {
  test('should load quickly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have optimized images', async ({ page }) => {
    await page.goto('/');
    
    // Check that images have proper attributes
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      
      // Check for alt text
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
      
      // Check for lazy loading (optional but recommended)
      const loading = await img.getAttribute('loading');
      const hasLazyLoading = loading === 'lazy' || (await img.getAttribute('data-lazy')) !== null;
      
      // At least some images should use lazy loading
      if (i > 0) { // Skip hero images
        expect(hasLazyLoading).toBeTruthy();
      }
    }
  });
});