import { expect, test } from './fixtures'

// Writes to the real API: smokeFavorites removes the test pseudo's likes before and after.
test('like then unlike a quote', async ({ app, page, smokeFavorites }) => {
  // Setup without the UI: the pseudo is in localStorage before the app starts.
  await page.addInitScript(alias => localStorage.setItem('kaamelott.alias', alias), smokeFavorites)
  await app.goto()
  await expect(app.likeButton).toHaveAccessibleName('Ajouter aux favoris')
  const before = Number(await app.likeButton.textContent())

  await app.likeButton.click()

  await expect(app.likeButton).toHaveAccessibleName('Retirer des favoris')
  await expect(app.likeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(app.likeButton).toHaveText(String(before + 1))

  await app.likeButton.click()

  await expect(app.likeButton).toHaveAccessibleName('Ajouter aux favoris')
  await expect(app.likeButton).toHaveAttribute('aria-pressed', 'false')
  await expect(app.likeButton).toHaveText(String(before))
})
