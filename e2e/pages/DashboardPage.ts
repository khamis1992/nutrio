import { Page, Locator } from '@playwright/test';
import { appUrl } from '../config';

export class DashboardPage {
  readonly page: Page;
  readonly favoritesBtn: Locator;
  readonly notificationsBtn: Locator;
  readonly tabBar: Locator;
  readonly subscriptionCard: Locator;
  readonly goalCard: Locator;
  readonly nutritionCard: Locator;
  readonly orderFab: Locator;
  readonly logFab: Locator;
  readonly coachesFab: Locator;
  readonly communityFab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.favoritesBtn = page.locator('[data-testid="dashboard-favorites-btn"]');
    this.notificationsBtn = page.locator('[data-testid="dashboard-notifications-btn"]');
    this.tabBar = page.locator('[data-testid="dashboard-tab-bar"]');
    this.subscriptionCard = page.locator('[data-testid="dashboard-subscription-card"]');
    this.goalCard = page.locator('[data-testid="dashboard-goal-card"]');
    this.nutritionCard = page.locator('[data-testid="dashboard-nutrition-card"]');
    this.orderFab = page.locator('[data-testid="dashboard-fab-order"]');
    this.logFab = page.locator('[data-testid="dashboard-fab-log"]');
    this.coachesFab = page.locator('[data-testid="dashboard-fab-coaches"]');
    this.communityFab = page.locator('[data-testid="dashboard-fab-community"]');
  }

  async goto() {
    await this.page.goto(appUrl('/dashboard'));
    await this.page.waitForLoadState('networkidle');
  }

  async clickFavorites() {
    await this.favoritesBtn.click();
  }

  async clickNotifications() {
    await this.notificationsBtn.click();
  }

  async clickOrderFab() {
    await this.orderFab.click();
  }

  async clickLogFab() {
    await this.logFab.click();
  }
}
