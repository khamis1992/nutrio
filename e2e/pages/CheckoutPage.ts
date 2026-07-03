import { Page, Locator } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly placeOrderBtn: Locator;
  readonly backBtn: Locator;
  readonly simCardBtn: Locator;
  readonly simSadadBtn: Locator;
  readonly changePaymentBtn: Locator;
  readonly simSadadPayBtn: Locator;
  readonly simWalletPayBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.placeOrderBtn = page.locator('[data-testid="checkout-place-order-btn"]');
    this.backBtn = page.locator('[data-testid="checkout-back-btn"]');
    this.simCardBtn = page.locator('[data-testid="checkout-sim-card-btn"]');
    this.simSadadBtn = page.locator('[data-testid="checkout-sim-sadad-btn"]');
    this.changePaymentBtn = page.locator('[data-testid="checkout-change-payment-btn"]');
    this.simSadadPayBtn = page.locator('[data-testid="checkout-sim-sadad-pay-btn"]');
    this.simWalletPayBtn = page.locator('[data-testid="checkout-sim-wallet-pay-btn"]');
  }

  async goto() {
    await this.page.goto('/checkout');
    await this.page.waitForLoadState('networkidle');
  }

  async placeOrder() {
    await this.placeOrderBtn.click();
  }

  async simulateCardPayment() {
    await this.simCardBtn.click();
  }

  async simulateSadadPayment() {
    await this.simSadadBtn.click();
    await this.simSadadPayBtn.click();
  }

  async simulateWalletPayment() {
    await this.simWalletPayBtn.click();
  }
}
