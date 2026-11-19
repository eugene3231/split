export default async function separateProfiles({ page, step, shot, profile, storage, assert }) {
  await step('the first person loads Lunch for 3', async () => {
    await page.getByTestId('workspace-menu-btn').click();
    await page.getByTestId('workspace-preset-lunch-for-three').click();
    await page.getByTestId('wizard-step-panel').getByText('Truffle Fries').first().waitFor();
  });

  const other = await step('a second person opens the app in their own profile', async () => {
    const second = await profile();
    await second.getByTestId('people-empty-state').waitFor();
    await shot('second-profile', second);
    return second;
  });

  await step('each profile keeps its own saved split', async () => {
    const mine = (await storage())['split:receipt-draft:v1'];
    const theirs = (await storage(other))['split:receipt-draft:v1'];
    assert.deepEqual(
      mine.people.map((p) => p.name),
      ['Alice', 'Bob', 'Charlie'],
    );
    assert.deepEqual(theirs?.people ?? [], []);
  });
}
