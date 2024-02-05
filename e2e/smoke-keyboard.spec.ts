import { test, expect, Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('http://localhost:1234/');

  // Setup the KeyMap
  await page.evaluate('localStorage.setItem("keyMap", "{}")')

  // Reload for changes to take effect
  await page.goto('http://localhost:1234/');
}

test('test', async ({ page }) => {
  const focused = page.locator(':focus')

  async function typeIn(input: string, ...restKeys: string[]) {
    const keys = [
      ...input
        .split('')
        .filter(char => char !== '')
      ,
      ...restKeys,
    ];
    for (const key of keys) {
      await focused.press(key);
    }
  }

  async function jumpInputEnd() {
    // Control+e doesn't work in Firefox in playwright (although it works in the "real" Firefox)
    await typeIn('', 'Control+e', 'Meta+ArrowRight');
  }

  await setup(page)

  // Focus "Tables" header
  await typeIn('', 'Enter', 'Enter');
  await jumpInputEnd();
  await typeIn(' Test', 'Escape');

  // Append at bottom
  await typeIn('', 'Shift+g', 'o', 'Enter');
  await typeIn('Hello World!', 'Enter');
  await typeIn('Delete this', 'Alt+Backspace', 'Enter');
  await typeIn('', 'Enter');
  await typeIn('= $0.text + $65.text + $66.text + $67.text');

  // Open CommandSearch
  await typeIn('', 'Control+Shift+P');
  await typeIn('new child', 'Enter');

  // Name new Page
  await typeIn('Child', 'Enter');

  // Focus Note
  await typeIn('', 'Enter', 'Enter');

  // Create JSExpr Block
  await typeIn('/blocks.JSExpr', 'Control+Enter');
  await typeIn('Math.abs(-10)', 'Escape', 'Escape');

  // Focus Introduction Page
  await typeIn('', 'ArrowUp', 'Enter');

  // Focus Last Line
  await typeIn('', 'Shift+g', 'Enter');
  await jumpInputEnd();
  await typeIn(' + Child', 'Escape', 'Escape');

  // Create new Page
  await typeIn('', 'Control+n');

  // Name new Page
  await typeIn('Result', 'Enter');

  // Focus Note
  await typeIn('', 'Enter', 'Enter');
  await typeIn('= <span>{Introduction}</span>');

  await expect(page.locator('#app')).toContainText('Tables TestHello World!Delete 10');
});