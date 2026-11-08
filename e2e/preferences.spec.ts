import { expect, test } from './fixtures'

test('choosing a character shows only their quotes', async ({ app }) => {
  await app.goto()

  await app.chooseCharacter('Perceval')

  await expect(app.subtitle).toHaveText('Perceval')
  await expect(app.character).toHaveText('Perceval')
  await app.nextButton.click()
  await expect(app.character).toHaveText('Perceval')
})
