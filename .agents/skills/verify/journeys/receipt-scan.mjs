// Gemini is a paid API behind one fetch, so this journey answers for it with page.route.
// Everything inside the app runs for real: the key dialog, the upload, the scan state,
// parsing the response, and filling the receipt.
const GEMINI = 'https://generativelanguage.googleapis.com/**';
const FAKE_KEY = 'AIza-verify-not-a-real-key';
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);
const SCANNED = {
  items: [
    { description: 'Nasi Lemak', amount: 6.5 },
    { description: 'Teh Tarik', amount: 2.2 },
  ],
  subtotal: 8.7,
  total: 10.43,
  detected: {
    gst: { enabled: true, amount: null, percent: 9, confidence: 0.9, source: 'GST 9%' },
    serviceCharge: { enabled: true, amount: null, percent: 10, confidence: 0.9, source: 'SVC 10%' },
  },
  warnings: [],
};

export default async function receiptScan({ page, step, aria, storage, assert }) {
  const sent = [];
  let answer;
  const answered = new Promise((resolve) => (answer = resolve));
  await page.route(GEMINI, async (route) => {
    sent.push(route.request());
    await answered;
    await route.fulfill({
      json: { candidates: [{ content: { parts: [{ text: JSON.stringify(SCANNED) }] } }] },
    });
  });

  await step('add Dana, then save a Gemini key on the Receipt step', async () => {
    await page.getByTestId('people-input').fill('Dana');
    await page.getByTestId('people-add-btn').click();
    await page.getByTestId('wizard-continue-btn').click();
    const dialog = page.getByRole('dialog', { name: 'Gemini API key' });
    await dialog.getByRole('textbox', { name: 'API key', exact: true }).fill(FAKE_KEY);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await dialog.waitFor({ state: 'hidden' });
  });

  await step('upload a photo and start the scan', async () => {
    await page
      .getByTestId('receipt-file-input')
      .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PHOTO });
    await page.getByTestId('scan-receipt-btn').click();
    await page.getByTestId('scan-shimmer').waitFor();
  });

  await step('the request carries the key and the photo', async () => {
    assert.equal(sent.length, 1, 'one Gemini request');
    const [request] = sent;
    assert.equal(request.headers()['x-goog-api-key'], FAKE_KEY);
    const part = request.postDataJSON().contents[0].parts[1].inlineData;
    assert.deepEqual(part, { mimeType: 'image/png', data: PHOTO.toString('base64') });
    answer();
  });

  await step('the scanned items fill the receipt', async () => {
    await page.getByTestId('scan-shimmer').waitFor({ state: 'detached' });
    const names = page.getByPlaceholder('Item name');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('input[placeholder="Item name"]')].some(
        (input) => input.value === 'Teh Tarik',
      ),
    );
    const values = await names.evaluateAll((inputs) => inputs.map((input) => input.value));
    assert.ok(values.includes('Nasi Lemak') && values.includes('Teh Tarik'), values.join(', '));
    await page.getByText('Detected via SVC 10%').waitFor();
    await page.getByText('Detected via GST 9%').waitFor();
    await aria('receipt-after-scan', page.getByTestId('wizard-step-panel'));
  });

  await step('the draft saves the scanned items', async () => {
    const draft = (await storage())['split:receipt-draft:v1'];
    const items = draft.receipts[0].items
      .filter((item) => item.name)
      .map((item) => [item.name, Number(item.amountInput)]);
    assert.deepEqual(items, [
      ['Nasi Lemak', 6.5],
      ['Teh Tarik', 2.2],
    ]);
  });
}
