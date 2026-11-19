import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function testSplitSummary({
  page,
  step,
  aria,
  save,
  storage,
  assert,
  evidenceDir,
}) {
  await step('load Lunch for 3 from the Split menu', async () => {
    await page.getByTestId('workspace-menu-btn').click();
    await page.getByTestId('workspace-preset-lunch-for-three').click();
    await page.getByTestId('wizard-step-panel').getByText('Truffle Fries').first().waitFor();
    assert.match(await page.getByTestId('wizard-continue-btn').innerText(), /^Next: Bob/);
  });

  await step('walk Bob and Charlie, then open the summary', async () => {
    const next = page.getByTestId('wizard-continue-btn');
    for (const label of ['Next: Bob', 'Next: Charlie', 'See summary']) {
      await page.waitForFunction(
        (want) =>
          document
            .querySelector('[data-testid="wizard-continue-btn"]')
            ?.textContent?.startsWith(want),
        label,
      );
      await next.click();
    }
    await page.getByTestId('grand-total-card').waitFor();
    assert.match(await page.getByTestId('grand-total-card').innerText(), /47\.48/);
    await aria('summary');
  });

  await step('each person total matches the split', async () => {
    const tree = await page.getByRole('main').last().ariaSnapshot();
    for (const [name, total] of [
      ['Alice', '14.99'],
      ['Bob', '21.34'],
      ['Charlie', '11.15'],
    ]) {
      const card = new RegExp(
        `heading "${name}" \\[level=3\\]\\n\\s+- text: Total\\n\\s+- paragraph: \\$${total.replace('.', '\\.')}`,
      );
      assert.match(tree, card, `${name}'s card total is $${total}`);
    }
  });

  await step('copy text puts every person and the total on the clipboard', async () => {
    await page.getByTestId('export-copy-text-btn').click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    save('clipboard.txt', clipboard);
    for (const name of ['Alice', 'Bob', 'Charlie', '47.48'])
      assert.ok(clipboard.includes(name), `clipboard has ${name}`);
  });

  await step('save image downloads a PNG', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-save-image-btn').click(),
    ]);
    const file = join(evidenceDir, `export-${download.suggestedFilename()}`);
    await download.saveAs(file);
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG', 'download is a PNG');
    assert.ok(bytes.length > 10_000, `PNG has content (${bytes.length} bytes)`);
  });

  await step('the split survives a reload', async () => {
    const saved = await storage();
    const draft = saved['split:receipt-draft:v1'];
    assert.deepEqual(
      draft.people.map((p) => p.name),
      ['Alice', 'Bob', 'Charlie'],
    );
    await page.reload();
    await page.getByTestId('grand-total-card').waitFor();
    assert.match(await page.getByTestId('grand-total-card').innerText(), /47\.48/);
  });
}
