import { expect, test, type Page } from '@playwright/test';

const SAVE_KEY = 'word-islands.save.v1';

async function seed(page: Page, save: object | null) {
  await page.addInitScript(([k, s]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    if (s) localStorage.setItem(k as string, s as string);
  }, [SAVE_KEY, save ? JSON.stringify(save) : null]);
}

async function levelWords(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __wi: { app: { level: { words: { word: string }[] } } } }).__wi.app.level.words.map((w) => w.word));
}

async function drag(page: Page, word: string) {
  const pts = await page.evaluate((word) => {
    const els = [...document.querySelectorAll('.wheel .letter')];
    const used = new Set<number>();
    return [...word].map((ch) => {
      const i = els.findIndex((x, k) => x.textContent === ch && !used.has(k));
      used.add(i);
      const r = els[i].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  }, word);
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 6 });
  await page.mouse.up();
}

const progress = (lang: string, level: number) => ({
  version: 1, lang, music: false, sound: false, coins: 50, tutorialDone: true,
  progress: { [lang]: { level, found: [], bonus: [], revealed: [], freeHintUsed: false } },
});

test('first launch drops the player into level 1 with the tutorial within 5 seconds', async ({ page }) => {
  await seed(page, null);
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.locator('.wheel .letter').first()).toBeVisible({ timeout: 5000 });
  expect(Date.now() - t0).toBeLessThan(5000);
  await expect(page.locator('.tut-text')).toBeVisible();
  await expect(page.locator('.tut-hand')).toBeVisible();
});

test('dragging across letters solves level 1 and the island grows', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  await expect(page.locator('.wheel .letter').first()).toBeVisible();
  const words = await levelWords(page);
  for (const w of words) {
    await drag(page, w);
    await page.waitForTimeout(1300);
  }
  await expect(page.getByTestId('next')).toBeVisible({ timeout: 5000 });
  const pieces = await page.evaluate(() => (window as unknown as { __wi: { world: { island(): { visiblePieces: number } } } }).__wi.world.island().visiblePieces);
  expect(pieces).toBeGreaterThan(0);
  await page.getByTestId('next').click();
  await expect(page.locator('.hud .title small')).toHaveText('Level 2');
  // tutorial is shown once
  await expect(page.locator('.tut-text')).toHaveCount(0);
});

test('keyboard typing, Backspace and Enter work; Escape does nothing', async ({ page }) => {
  await seed(page, progress('en', 1));
  await page.goto('/');
  await page.getByTestId('play').click();
  const [word] = await levelWords(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.overlay')).toHaveCount(0);
  for (const ch of word.toLowerCase()) await page.keyboard.press(ch);
  await page.keyboard.press('Backspace');
  await expect(page.locator('.preview span')).toHaveCount(word.length - 1);
  await page.keyboard.press(word.toLowerCase().at(-1)!);
  await page.keyboard.press('Enter');
  await expect(page.locator('.cell.filled')).toHaveCount(word.length, { timeout: 12000 });
});

test('Russian levels show Cyrillic letters and accept Cyrillic keys', async ({ page }) => {
  await seed(page, progress('ru', 0));
  await page.goto('/');
  await page.getByTestId('play').click();
  await expect(page.locator('.wheel .letter').first()).toBeVisible();
  const letters = await page.locator('.wheel .letter').allTextContents();
  for (const l of letters) expect(l).toMatch(/^[А-Я]$/);
  const [word] = await levelWords(page);
  // a Russian (ЙЦУКЕН) keyboard sends Cyrillic key values; Playwright's US layout can't, so dispatch them
  await page.evaluate((w) => {
    for (const ch of w.toLowerCase()) window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code: 'KeyX' }));
  }, word);
  await page.keyboard.press('Enter');
  await expect(page.locator('.cell.filled')).toHaveCount(word.length, { timeout: 12000 });
});

test('the web build has no rewarded-ad button', async ({ page }) => {
  await seed(page, { ...progress('en', 1), coins: 0 });
  await page.goto('/');
  await page.getByTestId('play').click();
  await page.getByTestId('hint').click(); // free hint
  await page.getByTestId('hint').click(); // costs coins -> not enough
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.getByText('Watch an ad')).toHaveCount(0);
});

test('pause menu opens and resumes', async ({ page }) => {
  await seed(page, progress('en', 1));
  await page.goto('/');
  await page.getByTestId('play').click();
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('resume')).toBeVisible();
  await page.getByTestId('resume').click();
  await expect(page.locator('.overlay')).toHaveCount(0);
});

for (const [w, h] of [[390, 844], [844, 390], [1280, 720], [1920, 1080]] as const) {
  test(`all controls are visible without scrolling at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await seed(page, progress('en', 1));
    await page.goto('/');
    for (const id of ['play']) await expectInside(page, `[data-testid="${id}"]`, w, h);
    await page.getByTestId('play').click();
    await page.waitForTimeout(400);
    for (const sel of ['[data-testid="pause"]', '[data-testid="shuffle"]', '[data-testid="hint"]', '[data-testid="reveal"]', '.pill', '.wheel', '.board', '.goal']) {
      await expectInside(page, sel, w, h);
    }
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    expect(scroll[0]).toBeLessThanOrEqual(w);
    expect(scroll[1]).toBeLessThanOrEqual(h);
  });
}

async function expectInside(page: Page, sel: string, w: number, h: number) {
  const box = await page.locator(sel).first().boundingBox();
  expect(box, sel).not.toBeNull();
  expect(box!.x, `${sel} left`).toBeGreaterThanOrEqual(0);
  expect(box!.y, `${sel} top`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${sel} right`).toBeLessThanOrEqual(w + 0.5);
  expect(box!.y + box!.height, `${sel} bottom`).toBeLessThanOrEqual(h + 0.5);
}
