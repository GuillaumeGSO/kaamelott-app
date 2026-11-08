import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'

// The pseudo the smoke tests like quotes with. Its likes are removed before and after each test.
export const SMOKE_ALIAS = 'smoke-test'

// Page object: the app's locators and actions in one place, so specs read as user steps.
export class AppPage {
  readonly page: Page
  readonly heading
  readonly subtitle
  readonly quote
  readonly character
  readonly nextButton
  readonly likeButton
  readonly preferencesButton
  readonly preferences

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Citations Kaamelott' })
    this.subtitle = page.locator('.app-subtitle')
    this.quote = page.getByRole('blockquote')
    this.character = page.locator('.quote-character')
    this.nextButton = page.getByRole('button', { name: 'Encore une !' })
    this.likeButton = page.getByRole('button', { name: /favoris/ })
    this.preferencesButton = page.getByRole('button', { name: 'Préférences' })
    this.preferences = page.getByRole('dialog', { name: 'Préférences' })
  }

  // Opens a page of the app and waits for the first quote.
  async goto(path = '/') {
    await this.page.goto(path)
    await expect(this.quote).toHaveText(/\S/)
  }

  async chooseCharacter(name: string) {
    await this.preferencesButton.click()
    await expect(this.preferences).toBeVisible()
    await this.preferences.getByPlaceholder(/^Chercher parmi/).fill(name)
    await this.preferences.getByRole('radio', { name: new RegExp(`^${name}, \\d+ citations$`) }).check()
    await this.preferences.getByRole('button', { name: 'Voir les citations' }).click()
    await expect(this.preferences).toBeHidden()
  }
}

// Same-origin API calls: the dev server proxy (or CloudFront) adds the key.
async function removeSmokeLikes(request: APIRequestContext) {
  const response = await request.get(`/favorites?${new URLSearchParams({ alias: SMOKE_ALIAS })}`)
  if (response.status() === 404) return // no favorites
  expect(response.ok(), `GET /favorites: HTTP ${response.status()}`).toBe(true)
  const { quoteIds } = (await response.json()) as { quoteIds: string[] }
  for (const quoteId of quoteIds) {
    const unlike = await request.post('/favorites', { data: { quoteId, alias: SMOKE_ALIAS, favorite: false } })
    expect(unlike.ok(), `POST /favorites: HTTP ${unlike.status()}`).toBe(true)
  }
}

export const test = base.extend<{ app: AppPage; smokeFavorites: string }>({
  app: async ({ page }, use) => {
    await use(new AppPage(page))
  },
  // Gives the test pseudo, with no likes before the test (even after a crashed run) and none left after.
  smokeFavorites: async ({ request }, use) => {
    await removeSmokeLikes(request)
    await use(SMOKE_ALIAS)
    await removeSmokeLikes(request)
  },
})

export { expect }
