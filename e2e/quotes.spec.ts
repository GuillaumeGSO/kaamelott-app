import { expect, test } from './fixtures'

test('shows a quote and the license credits', async ({ app, page }) => {
  await app.goto()

  await expect(app.heading).toBeVisible()
  await expect(app.character).toHaveText(/\S/)
  // Required by the quotes' license (CC BY-SA 4.0): source link and license link.
  await expect(page.getByRole('link', { name: 'Wikiquote' })).toHaveAttribute(
    'href',
    'https://fr.wikiquote.org/wiki/Kaamelott',
  )
  await expect(page.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
    'href',
    'https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
  )
})

test('"Encore une !" shows another quote', async ({ app }) => {
  await app.goto()
  const first = await app.quote.textContent()

  await app.nextButton.click()

  await expect(app.quote).not.toHaveText(first ?? '')
  await expect(app.quote).toHaveText(/\S/)
})

test('a deep link still loads the app', async ({ app }) => {
  // SPA fallback: Vite locally, the CloudFront Function on a deployed site.
  await app.goto('/une/route/profonde')

  await expect(app.heading).toBeVisible()
})
