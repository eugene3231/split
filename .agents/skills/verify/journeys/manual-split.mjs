export default async function manualSplit({ page, step, aria, storage, assert }) {
  const continueTo = async (label) => {
    await page.waitForFunction(
      (want) =>
        document
          .querySelector('[data-testid="wizard-continue-btn"]')
          ?.textContent?.startsWith(want),
      label,
    );
    await page.getByTestId('wizard-continue-btn').click();
  };

  await step('add Dana and Eli from one comma-separated entry', async () => {
    await page.getByTestId('people-empty-state').waitFor();
    await page.getByTestId('people-input').fill('Dana, Eli');
    await page.getByTestId('people-add-btn').click();
    const chips = await page.getByTestId('people-list').getByRole('button').allInnerTexts();
    assert.equal(chips.length, 2);
    assert.ok(chips.some((c) => c.includes('Dana')) && chips.some((c) => c.includes('Eli')));
  });

  await step('enter two items on the receipt', async () => {
    await continueTo('');
    await page
      .getByRole('dialog', { name: 'Gemini API key' })
      .getByRole('button', { name: 'Skip' })
      .click();
    assert.equal(
      await page.getByPlaceholder('Item name').count(),
      1,
      'a new receipt starts with one blank item',
    );
    for (const [index, [name, price]] of [
      ['Laksa', '12.00'],
      ['Kopi', '3.00'],
    ].entries()) {
      if (index > 0) await page.getByTestId('receipt-add-item-btn').click();
      await page.getByPlaceholder('Item name').last().fill(name);
      await page.getByRole('textbox', { name: 'Price' }).last().fill(price);
    }
    await aria('receipt', page.getByTestId('wizard-step-panel'));
  });

  await step('Dana takes the Laksa', async () => {
    await continueTo('');
    await page
      .getByRole('group', { name: 'Whose items' })
      .getByRole('button', { name: /Dana/ })
      .waitFor();
    await page.getByRole('checkbox', { name: 'Laksa', exact: true }).click();
    assert.match(await page.getByTestId('wizard-continue-btn').innerText(), /^Next: Eli/);
  });

  await step('Eli takes the Kopi, then open the summary', async () => {
    await continueTo('Next: Eli');
    await page.getByRole('checkbox', { name: 'Kopi', exact: true }).click();
    await continueTo('See summary');
    await page.getByTestId('grand-total-card').waitFor();
    assert.match(await page.getByTestId('grand-total-card').innerText(), /17\.99/);
    const tree = await page.getByRole('main').last().ariaSnapshot();
    assert.match(tree, /heading "Dana" \[level=3\]\n\s+- text: Total\n\s+- paragraph: \$14\.39/);
    assert.match(tree, /heading "Eli" \[level=3\]\n\s+- text: Total\n\s+- paragraph: \$3\.60/);
  });

  await step('the draft is saved with both assignments', async () => {
    const draft = (await storage())['split:receipt-draft:v1'];
    const names = Object.fromEntries(draft.people.map((p) => [p.id, p.name]));
    const items = draft.receipts[0].items.map((item) => ({
      name: item.name,
      owners: Object.keys(item.assignment.shares).map((id) => names[id]),
    }));
    assert.deepEqual(items, [
      { name: 'Laksa', owners: ['Dana'] },
      { name: 'Kopi', owners: ['Eli'] },
    ]);
  });
}
