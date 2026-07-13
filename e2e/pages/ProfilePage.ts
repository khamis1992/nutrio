import { Page, Locator } from '@playwright/test';
import { appUrl } from '../config';

export class ProfilePage {
  readonly page: Page;
  readonly backBtn: Locator;
  readonly notificationsBtn: Locator;
  readonly rewardsCard: Locator;
  readonly securityBtn: Locator;
  readonly affiliateBtn: Locator;
  readonly deleteAccountBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backBtn = page.locator('[data-testid="profile-back-btn"]');
    this.notificationsBtn = page.locator('[data-testid="profile-notifications-btn"]');
    this.rewardsCard = page.locator('[data-testid="profile-rewards-card"]');
    this.securityBtn = page.locator('[data-testid="profile-security-btn"]');
    this.affiliateBtn = page.locator('[data-testid="profile-affiliate-btn"]');
    this.deleteAccountBtn = page.locator('[data-testid="profile-delete-account-btn"]');
  }

  async goto() {
    await this.page.goto(appUrl('/profile'));
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToNotifications() {
    await this.notificationsBtn.click();
  }

  async navigateToRewards() {
    await this.rewardsCard.click();
  }

  async navigateToSecurity() {
    await this.securityBtn.click();
  }

  async navigateToAffiliate() {
    await this.affiliateBtn.click();
  }
}
