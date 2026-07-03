import { Page, Locator } from '@playwright/test';

export class TrackerPage {
  readonly page: Page;
  readonly backBtn: Locator;
  readonly progressBtn: Locator;
  readonly todayTab: Locator;
  readonly insightsTab: Locator;
  readonly weightUpdateBtn: Locator;
  readonly weightCloseBtn: Locator;
  readonly weightInput: Locator;
  readonly weightSaveBtn: Locator;
  readonly bmiEditBtn: Locator;
  readonly bmiCloseBtn: Locator;
  readonly bmiCancelBtn: Locator;
  readonly bmiSaveBtn: Locator;
  readonly waterLink: Locator;
  readonly stepsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backBtn = page.locator('[data-testid="tracker-back-btn"]');
    this.progressBtn = page.locator('[data-testid="tracker-progress-btn"]');
    this.todayTab = page.locator('[data-testid="tracker-tab-today"]');
    this.insightsTab = page.locator('[data-testid="tracker-tab-insights"]');
    this.weightUpdateBtn = page.locator('[data-testid="tracker-weight-update-btn"]');
    this.weightCloseBtn = page.locator('[data-testid="tracker-weight-close-btn"]');
    this.weightInput = page.locator('[data-testid="tracker-weight-input"]');
    this.weightSaveBtn = page.locator('[data-testid="tracker-weight-save-btn"]');
    this.bmiEditBtn = page.locator('[data-testid="tracker-bmi-edit-btn"]');
    this.bmiCloseBtn = page.locator('[data-testid="tracker-bmi-close-btn"]');
    this.bmiCancelBtn = page.locator('[data-testid="tracker-bmi-cancel-btn"]');
    this.bmiSaveBtn = page.locator('[data-testid="tracker-bmi-save-btn"]');
    this.waterLink = page.locator('[data-testid="tracker-water-link"]');
    this.stepsLink = page.locator('[data-testid="tracker-steps-link"]');
  }

  async goto() {
    await this.page.goto('/tracker');
    await this.page.waitForLoadState('networkidle');
  }

  async switchToInsights() {
    await this.insightsTab.click();
  }

  async updateWeight(kg: string) {
    await this.weightUpdateBtn.click();
    await this.weightInput.fill(kg);
    await this.weightSaveBtn.click();
  }

  async navigateToWater() {
    await this.waterLink.click();
  }

  async navigateToSteps() {
    await this.stepsLink.click();
  }
}
