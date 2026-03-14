# Cross-Portal Testing

<cite>
**Referenced Files in This Document**
- [README.md](file://e2e/cross-portal/README.md)
- [utils.ts](file://e2e/cross-portal/utils.ts)
- [order-lifecycle.spec.ts](file://e2e/cross-portal/order-lifecycle.spec.ts)
- [notifications-workflow.spec.ts](file://e2e/cross-portal/notifications-workflow.spec.ts)
- [wallet-payments.spec.ts](file://e2e/cross-portal/wallet-payments.spec.ts)
- [subscription-management.spec.ts](file://e2e/cross-portal/subscription-management.spec.ts)
- [payouts-workflow.spec.ts](file://e2e/cross-portal/payouts-workflow.spec.ts)
- [affiliate-referral.spec.ts](file://e2e/cross-portal/affiliate-referral.spec.ts)
- [run-cross-portal-tests.sh](file://scripts/run-cross-portal-tests.sh)
- [run-cross-portal-tests.bat](file://scripts/run-cross-portal-tests.bat)
- [FINAL-DELIVERABLE.md](file://e2e/cross-portal/FINAL-DELIVERABLE.md)
- [SUMMARY.md](file://e2e/cross-portal/SUMMARY.md)
- [TEST-RUN-REPORT.md](file://e2e/cross-portal/TEST-RUN-REPORT.md)
- [test.ts](file://e2e/fixtures/test.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document provides comprehensive cross-portal integration testing guidance for the Nutrio Fuel platform, validating workflows that span all four user portals: customer, partner, driver, and admin. The suite simulates real-world, multi-user, real-time interactions to ensure data consistency, shared authentication flows, and synchronized updates across portals. It covers order lifecycle management, notifications, financial workflows, payouts, subscriptions, and affiliate/referral systems, while addressing multi-tenant and role-based access patterns.

## Project Structure
The cross-portal test suite is organized under the e2e/cross-portal directory with supporting scripts and documentation. The structure enables parallel execution, shared utilities, and modular workflow coverage.

```mermaid
graph TB
subgraph "Cross-Portal Test Suite"
A["README.md<br/>Suite overview and usage"]
B["utils.ts<br/>Shared utilities and helpers"]
C["order-lifecycle.spec.ts<br/>Core order flow"]
D["notifications-workflow.spec.ts<br/>Real-time notifications"]
E["wallet-payments.spec.ts<br/>Financial ecosystem"]
F["subscription-management.spec.ts<br/>Subscriptions"]
G["payouts-workflow.spec.ts<br/>Payouts"]
H["affiliate-referral.spec.ts<br/>Affiliate program"]
I["run-cross-portal-tests.sh<br/>Linux/Mac runner"]
J["run-cross-portal-tests.bat<br/>Windows runner"]
K["FINAL-DELIVERABLE.md<br/>Final suite summary"]
L["SUMMARY.md<br/>Original suite summary"]
M["TEST-RUN-REPORT.md<br/>Execution results"]
N["test.ts<br/>Playwright fixtures"]
end
A --> B
B --> C
B --> D
B --> E
B --> F
B --> G
B --> H
I --> C
I --> D
I --> E
I --> F
I --> G
I --> H
J --> C
J --> D
J --> E
J --> F
J --> G
J --> H
K --> L
K --> M
N --> B
```

**Diagram sources**
- [README.md:1-460](file://e2e/cross-portal/README.md#L1-L460)
- [utils.ts:1-284](file://e2e/cross-portal/utils.ts#L1-L284)
- [order-lifecycle.spec.ts:1-192](file://e2e/cross-portal/order-lifecycle.spec.ts#L1-L192)
- [notifications-workflow.spec.ts:1-386](file://e2e/cross-portal/notifications-workflow.spec.ts#L1-L386)
- [wallet-payments.spec.ts:1-325](file://e2e/cross-portal/wallet-payments.spec.ts#L1-L325)
- [subscription-management.spec.ts:1-242](file://e2e/cross-portal/subscription-management.spec.ts#L1-L242)
- [payouts-workflow.spec.ts:1-298](file://e2e/cross-portal/payouts-workflow.spec.ts#L1-L298)
- [affiliate-referral.spec.ts:1-290](file://e2e/cross-portal/affiliate-referral.spec.ts#L1-L290)
- [run-cross-portal-tests.sh:1-79](file://scripts/run-cross-portal-tests.sh#L1-L79)
- [run-cross-portal-tests.bat:1-62](file://scripts/run-cross-portal-tests.bat#L1-L62)
- [FINAL-DELIVERABLE.md:1-407](file://e2e/cross-portal/FINAL-DELIVERABLE.md#L1-L407)
- [SUMMARY.md:1-402](file://e2e/cross-portal/SUMMARY.md#L1-L402)
- [TEST-RUN-REPORT.md:1-343](file://e2e/cross-portal/TEST-RUN-REPORT.md#L1-L343)
- [test.ts:1-49](file://e2e/fixtures/test.ts#L1-L49)

**Section sources**
- [README.md:1-460](file://e2e/cross-portal/README.md#L1-L460)
- [SUMMARY.md:1-402](file://e2e/cross-portal/SUMMARY.md#L1-L402)

## Core Components
The cross-portal test suite centers around shared utilities and modular workflow tests that validate end-to-end business processes across portals.

- Shared utilities: Centralized authentication, navigation, verification, and retry mechanisms for reliable multi-portal operations.
- Workflow tests: Five core workflows plus five newly added workflows covering order lifecycle, notifications, financial flows, subscriptions, payouts, and affiliate/referral programs.
- Execution scripts: Shell and batch runners for Linux/Mac and Windows environments.
- Test fixtures: Playwright fixtures enabling authenticated page contexts for individual portal tests.

Key capabilities:
- Parallel login and navigation across all portals
- Network idle waits and robust element interactions
- Timestamped test data and retry logic with exponential backoff
- Comprehensive verification of page loads and error states

**Section sources**
- [utils.ts:1-284](file://e2e/cross-portal/utils.ts#L1-L284)
- [README.md:272-460](file://e2e/cross-portal/README.md#L272-L460)
- [SUMMARY.md:200-314](file://e2e/cross-portal/SUMMARY.md#L200-L314)
- [test.ts:1-49](file://e2e/fixtures/test.ts#L1-L49)

## Architecture Overview
The cross-portal architecture uses isolated browser contexts per portal to simulate independent sessions and authentication states. Tests orchestrate simultaneous actions across portals to validate real-time data propagation and synchronized UI updates.

```mermaid
sequenceDiagram
participant Browser as "Playwright Browser"
participant Utils as "utils.ts"
participant Customer as "Customer Context/Page"
participant Partner as "Partner Context/Page"
participant Driver as "Driver Context/Page"
participant Admin as "Admin Context/Page"
Browser->>Utils : "loginAllPortals(pages)"
Utils->>Customer : "loginAsCustomer()"
Utils->>Partner : "loginAsPartner()"
Utils->>Driver : "loginAsDriver()"
Utils->>Admin : "loginAsAdmin()"
Note over Customer,Admin : "Parallel login across 4 portals"
Browser->>Utils : "navigateAllToDashboards(pages)"
Utils->>Customer : "goto('/dashboard')"
Utils->>Partner : "goto('/partner')"
Utils->>Driver : "goto('/driver')"
Utils->>Admin : "goto('/admin')"
Note over Customer,Admin : "Simultaneous navigation"
Browser->>Customer : "perform customer actions"
Browser->>Partner : "perform partner actions"
Browser->>Driver : "perform driver actions"
Browser->>Admin : "perform admin actions"
Note over Customer,Admin : "Real-time updates propagate"
```

**Diagram sources**
- [utils.ts:167-196](file://e2e/cross-portal/utils.ts#L167-L196)
- [order-lifecycle.spec.ts:60-71](file://e2e/cross-portal/order-lifecycle.spec.ts#L60-L71)

**Section sources**
- [README.md:134-271](file://e2e/cross-portal/README.md#L134-L271)
- [utils.ts:167-196](file://e2e/cross-portal/utils.ts#L167-L196)

## Detailed Component Analysis

### Order Lifecycle Workflow
Validates the complete order journey from customer ordering to admin oversight, ensuring real-time propagation across all portals.

```mermaid
flowchart TD
Start(["Start"]) --> Browse["Customer browses meals"]
Browse --> Checkout["Customer proceeds to checkout"]
Checkout --> PartnerView["Partner views orders"]
PartnerView --> DriverView["Driver views available orders"]
DriverView --> AdminOrders["Admin views orders"]
AdminOrders --> AdminAnalytics["Admin views analytics"]
AdminAnalytics --> AllActive["All portals active simultaneously"]
AllActive --> End(["End"])
```

**Diagram sources**
- [order-lifecycle.spec.ts:73-190](file://e2e/cross-portal/order-lifecycle.spec.ts#L73-L190)

Key validations:
- Parallel navigation and page load verification
- Simultaneous portal activation post-login
- Network idle waits and element existence checks

**Section sources**
- [order-lifecycle.spec.ts:1-192](file://e2e/cross-portal/order-lifecycle.spec.ts#L1-L192)
- [utils.ts:167-196](file://e2e/cross-portal/utils.ts#L167-L196)

### Notifications Workflow
End-to-end testing of the notification system across all portals, including order updates, delivery assignments, promotional offers, and administrative announcements.

```mermaid
sequenceDiagram
participant Admin as "Admin Portal"
participant Customer as "Customer Portal"
participant Partner as "Partner Portal"
participant Driver as "Driver Portal"
Admin->>Admin : "Navigate to notifications"
Admin->>Admin : "Send announcement"
Note over Admin : "Announcement broadcast"
Admin->>Customer : "Customer receives order/delivery updates"
Admin->>Partner : "Partner receives order/payout notifications"
Admin->>Driver : "Driver receives delivery/earnings notifications"
Note over Customer,Driver : "Real-time sync across portals"
Customer->>Customer : "Navigate from notification to order"
Partner->>Partner : "Navigate from notification to order details"
Driver->>Driver : "Navigate from notification to delivery"
```

**Diagram sources**
- [notifications-workflow.spec.ts:193-250](file://e2e/cross-portal/notifications-workflow.spec.ts#L193-L250)

Validation highlights:
- Simultaneous notifications viewing across 4 portals
- Navigation from notifications to relevant actions
- Announcement sending capability and receipt verification
- Notification settings management across portals

**Section sources**
- [notifications-workflow.spec.ts:1-386](file://e2e/cross-portal/notifications-workflow.spec.ts#L1-L386)
- [utils.ts:167-196](file://e2e/cross-portal/utils.ts#L167-L196)

### Wallet & Payments Workflow
Comprehensive financial ecosystem testing covering wallet balances, transactions, invoicing, and multi-portal financial oversight.

```mermaid
flowchart TD
Init(["Init"]) --> CustomerWallet["Customer views wallet"]
CustomerWallet --> Invoices["Customer views invoices"]
Invoices --> CheckoutWallet["Customer uses wallet at checkout"]
CheckoutWallet --> PartnerEarnings["Partner views earnings"]
PartnerEarnings --> PartnerPayouts["Partner views payouts"]
PartnerPayouts --> DriverEarnings["Driver views earnings"]
DriverEarnings --> DriverPayouts["Driver views payouts"]
DriverPayouts --> AdminPayouts["Admin views payouts"]
AdminPayouts --> AdminAnalytics["Admin views analytics"]
AdminAnalytics --> Sync["All portals synchronized"]
Sync --> End(["End"])
```

**Diagram sources**
- [wallet-payments.spec.ts:216-239](file://e2e/cross-portal/wallet-payments.spec.ts#L216-L239)

Focus areas:
- Wallet balance visibility and transaction history
- Checkout payment method availability
- Earnings and payout tracking for partners and drivers
- Administrative financial oversight and reporting
- Real-time synchronization of payment data

**Section sources**
- [wallet-payments.spec.ts:1-325](file://e2e/cross-portal/wallet-payments.spec.ts#L1-L325)
- [utils.ts:167-196](file://e2e/cross-portal/utils.ts#L167-L196)

### Subscription Management Workflow
Full subscription lifecycle testing across customer, admin, and partner portals, including plan management, freeze requests, and retention analytics.

```mermaid
flowchart TD
Start(["Start"]) --> CustomerSub["Customer views subscription plans"]
CustomerSub --> CustomerSchedule["Customer views schedule"]
CustomerSchedule --> AdminSub["Admin views subscriptions"]
AdminSub --> AdminFreeze["Admin manages freeze requests"]
AdminFreeze --> AdminRetention["Admin views retention analytics"]
AdminRetention --> PartnerOrders["Partner views subscription orders"]
PartnerOrders --> Sync["All portals active with subscription data"]
Sync --> End(["End"])
```

**Diagram sources**
- [subscription-management.spec.ts:190-210](file://e2e/cross-portal/subscription-management.spec.ts#L190-L210)

Coverage includes:
- Subscription plan selection and modification
- Delivery address management for subscriptions
- Freeze request handling and admin approvals
- Retention metrics and streak rewards
- Diet tag management for meal plans

**Section sources**
- [subscription-management.spec.ts:1-242](file://e2e/cross-portal/subscription-management.spec.ts#L1-L242)
- [utils.ts:167-196](file://e2e/cross-portal/utils.ts#L167-L196)

### Payouts Workflow
Complete payout process validation for partners, drivers, and administrators, including request submission, approval, and status tracking.

```mermaid
sequenceDiagram
participant Partner as "Partner Portal"
participant Driver as "Driver Portal"
participant Admin as "Admin Portal"
Partner->>Partner : "View earnings"
Partner->>Partner : "Request payout"
Partner->>Partner : "View payout history"
Driver->>Driver : "View earnings"
Driver->>Driver : "Request withdrawal"
Driver->>Driver : "View withdrawal history"
Admin->>Admin : "View pending payouts"
Admin->>Admin : "Approve partner payout"
Admin->>Admin : "Approve driver payout"
Admin->>Admin : "View payout reports"
Note over Partner,Admin : "Payout status reflected across portals"
```

**Diagram sources**
- [payouts-workflow.spec.ts:246-266](file://e2e/cross-portal/payouts-workflow.spec.ts#L246-L266)

Validation points:
- Earnings and payout history visibility
- Request submission and approval workflows
- Pending request tracking for administrators
- Real-time status updates across all involved portals

**Section sources**
- [payouts-workflow.spec.ts:1-298](file://e2e/cross-portal/payouts-workflow.spec.ts#L1-L298)
- [utils.ts:167-196](file://e2e/cross-portal/utils.ts#L167-L196)

### Affiliate & Referral Workflow
End-to-end affiliate program testing covering application, referral tracking, commission calculation, and administrative oversight.

```mermaid
flowchart TD
Start(["Start"]) --> CustomerDashboard["Customer views affiliate dashboard"]
CustomerDashboard --> Tracking["Customer views referral tracking"]
Tracking --> AdminApps["Admin views affiliate applications"]
AdminApps --> AdminPayouts["Admin views affiliate payouts"]
AdminPayouts --> AdminMilestones["Admin manages milestones"]
AdminMilestones --> ReferrerLink["Referrer views referral link"]
ReferrerLink --> ReferrerTracking["Referrer checks referrals"]
ReferrerTracking --> Sync["All portals active with affiliate data"]
Sync --> End(["End"])
```

**Diagram sources**
- [affiliate-referral.spec.ts:238-258](file://e2e/cross-portal/affiliate-referral.spec.ts#L238-L258)

Scope includes:
- Affiliate application and approval processes
- Referral link generation and sharing
- Referral tracking and performance metrics
- Commission calculation and payout processing
- Administrative analytics and milestone management

**Section sources**
- [affiliate-referral.spec.ts:1-290](file://e2e/cross-portal/affiliate-referral.spec.ts#L1-L290)
- [utils.ts:167-196](file://e2e/cross-portal/utils.ts#L167-L196)

### Test Utilities and Shared Fixtures
Centralized utilities and fixtures enable consistent, reliable cross-portal testing with parallel operations and robust error handling.

```mermaid
classDiagram
class CrossPortalUtils {
+waitForNetworkIdle(page, timeout)
+waitForElement(page, selector, timeout)
+safeClick(page, selector, maxRetries)
+safeFill(page, selector, value, maxRetries)
+loginAsCustomer(page)
+loginAsAdmin(page)
+loginAsPartner(page)
+loginAsDriver(page)
+loginAllPortals(pages)
+navigateAllToDashboards(pages)
+verifyPageLoaded(page, expectedText?)
+takeScreenshot(page, name)
+getTestTimestamp()
+retryWithBackoff(operation, maxRetries, baseDelay)
+elementExists(page, selector)
+getTextContent(page, selector)
}
class TestFixtures {
+authenticatedCustomerPage(page)
+authenticatedAdminPage(page)
+authenticatedPartnerPage(page)
+authenticatedDriverPage(page)
}
CrossPortalUtils <.. TestFixtures : "used by"
```

**Diagram sources**
- [utils.ts:1-284](file://e2e/cross-portal/utils.ts#L1-L284)
- [test.ts:1-49](file://e2e/fixtures/test.ts#L1-L49)

Key features:
- Parallel authentication and navigation
- Robust element interaction with retries
- Network idle detection and page verification
- Timestamped test data generation
- Exponential backoff for resilient operations

**Section sources**
- [utils.ts:1-284](file://e2e/cross-portal/utils.ts#L1-L284)
- [test.ts:1-49](file://e2e/fixtures/test.ts#L1-L49)

## Dependency Analysis
The cross-portal test suite exhibits clear module separation with shared utilities as the central dependency for all workflow tests.

```mermaid
graph TB
Utils["utils.ts"]
Order["order-lifecycle.spec.ts"]
Notify["notifications-workflow.spec.ts"]
Wallet["wallet-payments.spec.ts"]
Sub["subscription-management.spec.ts"]
Payouts["payouts-workflow.spec.ts"]
Aff["affiliate-referral.spec.ts"]
Fixtures["test.ts"]
Utils --> Order
Utils --> Notify
Utils --> Wallet
Utils --> Sub
Utils --> Payouts
Utils --> Aff
Fixtures --> Utils
```

**Diagram sources**
- [utils.ts:1-284](file://e2e/cross-portal/utils.ts#L1-L284)
- [order-lifecycle.spec.ts:14-26](file://e2e/cross-portal/order-lifecycle.spec.ts#L14-L26)
- [notifications-workflow.spec.ts:23-33](file://e2e/cross-portal/notifications-workflow.spec.ts#L23-L33)
- [wallet-payments.spec.ts:23-34](file://e2e/cross-portal/wallet-payments.spec.ts#L23-L34)
- [subscription-management.spec.ts:19-30](file://e2e/cross-portal/subscription-management.spec.ts#L19-L30)
- [payouts-workflow.spec.ts:22-31](file://e2e/cross-portal/payouts-workflow.spec.ts#L22-L31)
- [affiliate-referral.spec.ts:22-32](file://e2e/cross-portal/affiliate-referral.spec.ts#L22-L32)
- [test.ts:6-48](file://e2e/fixtures/test.ts#L6-L48)

Dependencies and relationships:
- All workflow tests depend on shared utilities for authentication, navigation, and verification
- Playwright fixtures extend base tests with authenticated contexts
- Execution scripts coordinate test runs across platforms
- Documentation files provide comprehensive coverage and usage guidance

**Section sources**
- [README.md:272-460](file://e2e/cross-portal/README.md#L272-L460)
- [SUMMARY.md:200-314](file://e2e/cross-portal/SUMMARY.md#L200-L314)

## Performance Considerations
The cross-portal test suite is optimized for speed and reliability through parallel execution and efficient resource utilization.

- Parallel execution: All portals log in and navigate simultaneously, reducing total execution time from sequential (~60 seconds) to parallel (~45-60 seconds depending on workers)
- Network idle detection: Waits for network idle states to ensure page stability before assertions
- Retry mechanisms: Safe click/fill operations with exponential backoff improve resilience against transient failures
- Worker optimization: Configurable worker count enables scaling based on system resources

Performance metrics from recent runs demonstrate:
- 154 total tests executed in under 47 seconds with 10 parallel workers
- 98.7% pass rate with minimal flakiness
- Consistent execution across Linux/Mac and Windows environments

**Section sources**
- [TEST-RUN-REPORT.md:1-343](file://e2e/cross-portal/TEST-RUN-REPORT.md#L1-L343)
- [run-cross-portal-tests.sh:1-79](file://scripts/run-cross-portal-tests.sh#L1-L79)
- [run-cross-portal-tests.bat:1-62](file://scripts/run-cross-portal-tests.bat#L1-L62)

## Troubleshooting Guide
Common issues and their resolutions for cross-portal testing:

Authentication failures:
- Verify test users exist in the authentication backend
- Check portal-specific authentication routes (/auth, /partner/auth, /driver/auth)
- Ensure BASE_URL environment variable is correctly set

Network timeouts and navigation issues:
- Increase timeout values for slower routes
- Add waitForNetworkIdle with extended timeouts
- Implement retry logic for intermittent failures

Portals showing 404 errors:
- Verify route definitions in frontend application
- Confirm portal-specific routes (/admin, /partner, /driver) are properly configured
- Check for missing route handlers or incorrect base URLs

Execution conflicts:
- Close other test runs to free up ports
- Run with single worker (--workers=1) for debugging
- Use headed mode (--headed) to observe browser behavior

Test failures and fixes:
- Apply text expectation corrections for route content mismatches
- Increase timeouts for parallel navigation operations
- Implement proper cleanup of browser contexts after tests

**Section sources**
- [README.md:376-460](file://e2e/cross-portal/README.md#L376-L460)
- [TEST-RUN-REPORT.md:51-258](file://e2e/cross-portal/TEST-RUN-REPORT.md#L51-L258)

## Conclusion
The cross-portal test suite provides comprehensive, production-ready validation of multi-portal workflows across the Nutrio Fuel platform. With 154 tests spanning 10 workflows, the suite ensures real-time data consistency, shared authentication flows, and synchronized updates across customer, partner, driver, and admin portals. The modular architecture, parallel execution, and robust utilities enable reliable testing of complex business scenarios while maintaining maintainability and scalability for future enhancements.

## Appendices

### Test Scenarios and Coverage Matrix
The suite comprehensively covers critical business workflows with dedicated scenarios for each portal interaction pattern.

### Cross-Portal Test Data Management
- Timestamped test data generation for unique identifiers
- Shared test user credentials for consistent authentication
- Isolated browser contexts preventing data leakage between tests
- Cleanup procedures ensuring test isolation and repeatability

### Multi-Tenant and Role-Based Access Patterns
- Role-specific authentication flows for each portal type
- Permission-based navigation restrictions validated through testing
- Administrative oversight capabilities verified across all workflows
- Tenant isolation maintained through separate browser contexts

### Integration with CI/CD Pipelines
- Platform-specific runner scripts for seamless automation
- HTML report generation for detailed execution insights
- Parallel execution configuration for optimal CI performance
- Failure reporting and debugging capabilities integrated into test framework