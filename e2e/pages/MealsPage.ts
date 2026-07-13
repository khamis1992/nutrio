import { Page, Locator } from '@playwright/test';
import { appUrl } from '../config';

export class MealsPage {
  readonly page: Page;
  readonly backBtn: Locator;
  readonly favoritesFilter: Locator;
  readonly retryBtn: Locator;
  readonly subscriptionLink: Locator;
  readonly searchInput: Locator;
  readonly categoryTabs: Locator;
  readonly clearFiltersBtn: Locator;
  readonly showcaseLink: Locator;
  readonly restaurantCards: Locator;
  readonly favButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backBtn = page.locator('[data-testid="meals-back-btn"]');
    this.favoritesFilter = page.locator('[data-testid="meals-favorites-filter"]');
    this.retryBtn = page.locator('[data-testid="meals-retry-btn"]');
    this.subscriptionLink = page.locator('[data-testid="meals-subscription-link"]');
    this.searchInput = page.locator('[data-testid="meals-search-input"]');
    this.categoryTabs = page.locator('[data-testid^="meals-category-"]');
    this.clearFiltersBtn = page.locator('[data-testid="meals-clear-filters"]');
    this.showcaseLink = page.locator('[data-testid="meals-showcase-link"]');
    this.restaurantCards = page.locator('[data-testid="meals-restaurant-card"]');
    this.favButtons = page.locator('[data-testid="meals-fav-btn"]');
  }

  async goto() {
    await this.page.goto(appUrl('/meals'));
    await this.page.waitForLoadState('networkidle');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  async selectCategory(category: string) {
    await this.page.locator(`[data-testid="meals-category-${category}"]`).click();
  }

  async clickFirstRestaurant() {
    await this.restaurantCards.first().click();
  }
}
