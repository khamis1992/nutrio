import { Page, Locator } from '@playwright/test';

export class SubscriptionPage {
  readonly page: Page;
  readonly backBtn: Locator;
  readonly welcomeOffersBtn: Locator;
  readonly reactivateBtn: Locator;
  readonly plansBackBtn: Locator;
  readonly viewCardsBtn: Locator;
  readonly viewCompareBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backBtn = page.locator('[data-testid="subscription-back-btn"]');
    this.welcomeOffersBtn = page.locator('[data-testid="subscription-welcome-offers-btn"]');
    this.reactivateBtn = page.locator('[data-testid="subscription-reactivate-btn"]');
    this.plansBackBtn = page.locator('[data-testid="subscription-plans-back-btn"]');
    this.viewCardsBtn = page.locator('[data-testid="subscription-plans-view-cards"]');
    this.viewCompareBtn = page.locator('[data-testid="subscription-plans-view-compare"]');
  }

  async goto() {
    await this.page.goto('/subscription');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoPlans() {
    await this.page.goto('/subscription/plans');
    await this.page.waitForLoadState('networkidle');
  }

  async viewCards() {
    await this.viewCardsBtn.click();
  }

  async viewCompare() {
    await this.viewCompareBtn.click();
  }

  async reactivate() {
    await this.reactivateBtn.click();
  }
}
