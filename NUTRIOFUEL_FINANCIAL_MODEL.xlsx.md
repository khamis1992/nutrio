# NutriFuel Financial Model - Excel/Sheets Template

**Instructions:** Copy the content below into Excel or Google Sheets to create an interactive financial model.

---

## Sheet 1: ASSUMPTIONS

### A. Market Assumptions
```
Cell | Description | Value | Formula/Note
-----|-------------|-------|-------------
B2   | Target Market Size (Adults 25-45) | 500,000 | Local market
B3   | Health-Conscious % | 20% | Industry research
B4   | Addressable Market | 100,000 | =B2*B3
B5   | Year 1 Penetration | 0.5% | Conservative
B6   | Year 2 Penetration | 1.5% | Growth phase
B7   | Year 3 Penetration | 4.0% | Expansion
B8   | Year 4 Penetration | 7.0% | Maturing
B9   | Year 5 Penetration | 10.0% | Maturity
```

### B. Customer Metrics
```
Cell | Description | Value | Formula/Note
-----|-------------|-------|-------------
B12  | Average Orders/Month (Standard) | 8 | 2 per week
B13  | Average Orders/Month (Subscriber) | 14 | 3.5 per week
B14  | Average Order Value | $40 | Industry benchmark
B15  | Order Value Growth (Annual) | 2.5% | Inflation + premium
B16  | Customer Lifetime (Months) | 18 | Based on churn
B17  | Monthly Churn Rate (Current) | 5.5% | Industry average
B18  | Monthly Churn Rate (Target) | 3.0% | With improvements
```

### C. Acquisition & Retention
```
Cell | Description | Value | Formula/Note
-----|-------------|-------|-------------
B21  | Marketing Budget (Monthly) | $10,000 | Year 1 average
B22  | Customer Acquisition Cost | $30 | Weighted average
B23  | Referral Rate | 15% | % from referrals
B24  | Referral Bonus | $5 | Per successful referral
B25  | Affiliate Conversion Rate | 8.5% | Highest performing
```

### D. Pricing & Commission
```
Cell | Description | Value | Formula/Note
-----|-------------|-------|-------------
B28  | Platform Commission Rate | 15% | Configurable
B29  | Payment Processing Fee | 2.9% | Stripe standard
B30  | Delivery Fee (Standard) | $3.99 | Per order
B31  | Free Delivery Threshold | $50 | Order value
B32  | VIP Discount | 15% | On all meals
```

### E. Subscription Plans
```
Cell | Description | Value | Formula/Note
-----|-------------|-------|-------------
B35  | Basic Plan (Weekly) | $49.99 | 5 meals
B36  | Pro Plan (Weekly) | $99.99 | 14 meals
B37  | Premium Plan (Weekly) | $149.99 | Unlimited
B38  | VIP Elite (Weekly) | $199.99 | Unlimited + perks
B39  | Basic Plan Mix | 35% | Of subscribers
B40  | Pro Plan Mix | 40% | Of subscribers
B41  | Premium Plan Mix | 15% | Of subscribers
B42  | VIP Elite Mix | 10% | Of subscribers
```

### F. Cost Structure
```
Cell | Description | Value | Formula/Note
-----|-------------|-------|-------------
B45  | Fixed Costs (Monthly) | $26,800 | See breakdown
B46  | Technology (Servers, Dev) | $9,000 | 33.6% of fixed
B47  | Operations (Support, Office) | $7,500 | 28.0% of fixed
B48  | Marketing | $8,000 | 29.9% of fixed
B49  | Administrative | $2,300 | 8.5% of fixed
B50  | Variable Cost per Order | $5.06 | 12.65% of revenue
B51  | Variable Cost per Subscriber | $2.50 | 5% of subscription
```

### G. Growth Scenarios
```
Cell | Description | Value | Formula/Note
-----|-------------|-------|-------------
B54  | Best Case Growth (Monthly) | 25% | Aggressive
B55  | Base Case Growth (Monthly) | 15% | Moderate
B56  | Worst Case Growth (Monthly) | 5% | Conservative
```

---

## Sheet 2: UNIT ECONOMICS

### A. Customer Acquisition Cost (CAC)
```
Cell | Description | Formula | Example
-----|-------------|---------|--------
B2   | Organic Search CAC | $20 | Input
B3   | Social Media CAC | $42 | Input
B4   | Affiliate CAC | $12 | Input
B5   | Content Marketing CAC | $25 | Input
B6   | Partnerships CAC | $15 | Input
B7   | Influencer CAC | $50 | Input
B8   | Weighted Average CAC | =SUMPRODUCT(B2:B7, C2:C7)/SUM(C2:C7) | $30
B9   | Target CAC | $25 | Goal
```

### B. Customer Lifetime Value (LTV)
```
Cell | Description | Formula | Example
-----|-------------|---------|--------
B12  | Average Order Value | =Assumptions!B14 | $40
B13  | Orders per Month | =Assumptions!B12 | 8
B14  | Monthly Revenue | =B12*B13 | $320
B15  | Commission per Order | =B14*Assumptions!B28 | $48
B16  | Gross Profit per Month | =B15*Assumptions!B13 | $48
B17  | Customer Lifetime (Months) | =Assumptions!B16 | 18
B18  | LTV (Standard Customer) | =B16*B17 | $864
B19  | LTV (Basic Subscriber) | =Assumptions!B35*52*12*0.5 | $1,560
B20  | LTV (Pro Subscriber) | =Assumptions!B36*52*12*0.5 | $3,120
B21  | LTV (Premium Subscriber) | =Assumptions!B37*52*12*0.5 | $4,680
B22  | LTV (VIP Subscriber) | =Assumptions!B38*52*12*0.5 | $6,240
```

### C. LTV:CAC Ratios
```
Cell | Description | Formula | Value
-----|-------------|---------|------
B25  | LTV:CAC (Standard) | =B18/B8 | 28.8
B26  | LTV:CAC (Basic) | =B19/B8 | 52.0
B27  | LTV:CAC (Pro) | =B20/B8 | 104.0
B28  | LTV:CAC (Premium) | =B21/B8 | 156.0
B29  | LTV:CAC (VIP) | =B22/B8 | 208.0
B30  | Industry Benchmark | 3.0 | Target
```

### D. Payback Period
```
Cell | Description | Formula | Value
-----|-------------|---------|------
B33  | Payback (Standard) | =B8/B16 | 6.3 months
B34  | Payback (Basic) | =B8/(Assumptions!B35*4*0.5) | 2.1 months
B35  | Payback (Pro) | =B8/(Assumptions!B36*4*0.5) | 1.3 months
B36  | Payback (Premium) | =B8/(Assumptions!B37*4*0.5) | 0.9 months
B37  | Payback (VIP) | =B8/(Assumptions!B38*4*0.5) | 0.7 months
```

### E. Order Economics
```
Cell | Description | Formula | Value
-----|-------------|---------|------
B40  | Order Value | =Assumptions!B14 | $40.00
B41  | Platform Commission | =B40*Assumptions!B28 | $6.00
B42  | Payment Processing | =B40*Assumptions!B29 | $1.16
B43  | Server Costs | $0.40 | Input
B44  | Support Costs | $0.30 | Input
B45  | Marketing Allocation | $1.20 | Input
B46  | Total Costs | =SUM(B42:B45) | $3.06
B47  | Net Profit per Order | =B41-B46 | $2.94
B48  | Profit Margin | =B47/B40 | 7.35%
```

---

## Sheet 3: REVENUE MODEL

### A. Monthly Revenue Projection (Base Case)
```
Cell | Month | New Customers | Total Customers | Subscribers | Orders | Revenue
-----|-------|---------------|-----------------|-------------|--------|--------
B2   | 1     | 100           | =B2             | =B2*0.3     | =B2*8  | =B2*$40+$C2*$100
B3   | 2     | =B2*1.15      | =B2+B3          | =C3*0.35    | =C3*8  | =D3*$40+E3*8*$6
B4   | 3     | =B3*1.15      | =B3+B4          | =C4*0.4     | =C4*8  | =D4*$40+E4*8*$6
...  | ...   | ...           | ...             | ...         | ...    | ...
B13  | 12    | =B12*1.15     | =B11+B13        | =C13*0.45   | =C13*8 | =D13*$40+E13*8*$6
```

### B. Revenue Stream Breakdown
```
Cell | Description | Month 1 | Month 6 | Month 12 | Month 24
-----|-------------|---------|---------|----------|----------
B16  | Subscription Revenue | $8,000   | $35,000  | $85,000   | $350,000
B17  | Platform Commissions  | $4,000   | $18,000  | $42,000   | $180,000
B18  | Premium Analytics    | $500     | $3,000   | $8,000    | $35,000
B19  | Featured Listings    | $200     | $2,000   | $6,000    | $25,000
B20  | Affiliate Program     | $100     | $1,000   | $3,000    | $12,000
B21  | Promotional Partnerships | $50  | $500     | $1,500    | $6,000
B22  | TOTAL REVENUE         | =SUM(B16:B21) | =SUM(C16:C21) | ...
```

### C. ARPU Calculation
```
Cell | Description | Formula | Month 1 | Month 12
-----|-------------|---------|---------|----------
B25  | Total Revenue | =B22    | $12,850 | $145,500
B26  | Total Customers | =C2    | 100     | 1,800
B27  | ARPU | =B25/B26    | $128.50 | $80.83
B28  | ARPU (Subscribers) | =B16/(C2*0.3) | $266.67 | $157.41
B29  | ARPU (Standard) | =(B22-B16)/(C2*0.7) | $55.00 | $45.00
```

---

## Sheet 4: COST STRUCTURE

### A. Fixed Costs (Monthly)
```
Cell | Category | Amount | % of Total | Notes
-----|----------|--------|------------|-------
B2   | Technology | $9,000  | 33.6%     | Servers, Dev
B3   | Operations | $7,500  | 28.0%     | Support, Office
B4   | Marketing  | $8,000  | 29.9%     | Digital Ads
B5   | Administrative | $2,300 | 8.5%     | Legal, Admin
B6   | TOTAL FIXED COSTS | =SUM(B2:B5) | 100% |
```

### B. Variable Costs (Per Order)
```
Cell | Cost Item | Per Order | Formula | % of Revenue
-----|-----------|-----------|---------|-------------
B9   | Payment Processing | $1.16 | =B40*Assumptions!B29 | 2.9%
B10  | Server Costs | $0.40 | Input | 1.0%
B11  | Support Costs | $0.30 | Input | 0.75%
B12  | Marketing (Incremental) | $1.20 | Input | 3.0%
B13  | Affiliate Commission | $2.00 | Input | 5.0%
B14  | TOTAL VARIABLE COST | =SUM(B9:B13) | | 12.65%
```

### C. Cost Optimization
```
Cell | Initiative | Savings | Timeline | Impact
-----|------------|---------|----------|-------
B17  | Server Optimization | $450/month | Immediate | +$5,400/year
B18  | Support Automation | $2,000/month | 3 months | +$24,000/year
C18  | Marketing Efficiency | $1,500/month | Immediate | +$18,000/year
B19  | Total Annual Savings | =SUM(B17:B19)*12 | | +$47,400
```

---

## Sheet 5: BREAKEVEN ANALYSIS

### A. Breakeven Calculations
```
Cell | Description | Formula | Value
-----|-------------|---------|------
B2   | Fixed Costs (Monthly) | =Cost_Structure!B6 | $26,800
B3   | Contribution Margin per Order | =Unit_Economics!B47 | $2.94
B4   | Breakeven Orders per Month | =B2/B3 | 9,116
B5   | Breakeven Orders per Day | =B4/30 | 304
B6   | Breakeven Customers | =B4/8 | 1,139
B7   | Breakeven Subscribers | =B2/(Assumptions!B35*4*0.5) | 268
```

### B. Cash Flow Breakeven
```
Cell | Month | Revenue | Expenses | Cumulative
-----|-------|---------|----------|------------
B10  | 1     | $12,850 | $39,500  | -$26,650
B11  | 2     | $15,200 | $35,000  | -$46,450
B12  | 3     | $18,000  | $32,000  | -$60,450
...  | ...   | ...     | ...      | ...
B16  | 6     | $35,000 | $30,000  | -$75,000
...  | ...   | ...     | ...      | ...
B19  | 8     | $50,000 | $28,000  | -$65,000
...  | ...   | ...     | ...      | ...
B21  | 9     | $65,000 | $27,000  | -$27,000
...  | ...   | ...     | ...      | ...
B22  | 10    | $80,000 | $27,000  | +$26,000
```

---

## Sheet 6: GROWTH SCENARIOS

### A. Best Case Scenario
```
Cell | Month | Customers | Orders | Revenue | Profit | Cumulative
-----|-------|-----------|--------|---------|--------|------------
B2   | 6     | 3,500     | 25,000  | $285,000 | $42,000 | -$60,000
B3   | 12    | 8,000     | 60,000  | $720,000 | $115,000 | +$120,000
B4   | 18    | 15,000    | 120,000 | $1,500,000 | $250,000 | +$850,000
B5   | 24    | 25,000    | 200,000 | $2,600,000 | $450,000 | +$3,200,000
```

### B. Base Case Scenario
```
Cell | Month | Customers | Orders | Revenue | Profit | Cumulative
-----|-------|-----------|--------|---------|--------|------------
B8   | 6     | 1,800     | 12,000  | $135,000 | $18,000 | -$80,000
B9   | 12    | 3,500     | 25,000  | $285,000 | $42,000 | -$110,000
B10  | 18    | 5,500     | 40,000  | $480,000 | $75,000 | -$50,000
B11  | 24    | 7,500     | 55,000  | $680,000 | $110,000 | +$180,000
```

### C. Worst Case Scenario
```
Cell | Month | Customers | Orders | Revenue | Profit | Cumulative
-----|-------|-----------|--------|---------|--------|------------
B14  | 6     | 600       | 4,000   | $45,000  | $5,000   | -$130,000
B15  | 12    | 900       | 6,000   | $68,000  | $8,000   | -$280,000
B16  | 18    | 1,100     | 7,500   | $85,000  | $11,000  | -$450,000
B17  | 24    | 1,200     | 8,000   | $95,000  | $13,000  | -$640,000
```

---

## Sheet 7: 12-MONTH PROJECTIONS

### A. Monthly P&L
```
Cell | Month | Revenue | COGS | Gross Profit | OpEx | Op Income | Net Income
-----|-------|---------|------|--------------|------|-----------|------------
B2   | 1     | =Revenue!B22 | =Revenue!B22*0.065 | =B2-C2 | =Cost_Structure!B6 | =D2-E2 | =F2
B3   | 2     | =Revenue!C22 | =Revenue!C22*0.065 | =B3-C3 | =Cost_Structure!B6 | =D3-E3 | =F3
...  | ...   | ...      | ...    | ...          | ...  | ...       | ...
B13  | 12    | =Revenue!M22 | =Revenue!M22*0.065 | =B13-C13 | =Cost_Structure!B6 | =D13-E13 | =F13
```

### B. Key Metrics
```
Cell | Metric | Month 1 | Month 6 | Month 12
-----|--------|---------|---------|----------
B16  | Total Customers | 100     | 1,800   | 3,500
B17  | Subscribers | 30      | 600     | 1,500
B18  | Orders/Month | 800     | 12,000  | 25,000
B19  | ARPU | $128.50 | $75.00  | $80.83
B20  | LTV:CAC Ratio | 28.8    | 35.2    | 42.5
```

---

## Sheet 8: 5-YEAR MODEL

### A. Annual Summary
```
Cell | Year | Markets | Customers | Orders | Revenue | Gross Profit | OpEx | EBITDA | Net Income
-----|------|---------|-----------|--------|---------|--------------|------|--------|----------
B2   | 1    | 1       | 3,500     | 180K   | $1.2M   | $1.1M        | $1.35M | -$150K | -$180K
B3   | 2    | 3       | 8,500     | 520K   | $4.1M   | $3.8M        | $3.15M | $950K  | $700K
B4   | 3    | 8       | 25,000    | 1.8M   | $15M    | $13.5M       | $9M    | $4.5M  | $3.2M
B5   | 4    | 15      | 60,000    | 4.5M   | $38M    | $34M         | $20M   | $14M   | $10M
B6   | 5    | 25      | 120,000   | 9.5M   | $80M    | $71M         | $38M   | $33M   | $24M
```

### B. Valuation Projections
```
Cell | Year | Revenue | EBITDA | Revenue Multiple | Valuation
-----|------|---------|--------|------------------|------------
B9   | 1    | $1.2M   | -$150K  | 5x               | $6M
B10  | 2    | $4.1M   | $950K   | 5x               | $20M
B11  | 3    | $15M    | $4.5M   | 5x               | $75M
B12  | 4    | $38M    | $14M    | 5x               | $190M
B13  | 5    | $80M    | $33M    | 5x               | $400M
```

---

## Sheet 9: SENSITIVITY ANALYSIS

### A. Conversion Rate Sensitivity
```
Cell | Conversion | Monthly Revenue | Annual Revenue | Change
-----|------------|-----------------|----------------|--------
B2   | 2.0%       | $85,000         | $1,020,000     | -20%
B3   | 2.5%       | $95,000         | $1,140,000     | -10%
B4   | 3.0%       | $105,000        | $1,260,000     | Base
B5   | 3.5%       | $115,000        | $1,380,000     | +10%
B6   | 4.0%       | $125,000        | $1,500,000     | +20%
```

### B. Churn Rate Sensitivity
```
Cell | Churn Rate | Customer Lifetime | LTV | Annual Impact
-----|------------|-------------------|-----|---------------
B9   | 7.0%       | 14 months         | $672| -$45,000
B10  | 5.5%       | 18 months         | $864| Base
B11  | 4.0%       | 24 months         | $1,152| +$32,000
B12  | 3.0%       | 32 months         | $1,536| +$68,000
```

### C. CAC Sensitivity
```
Cell | CAC | LTV:CAC | Payback | Monthly Impact
-----|-----|---------|---------|---------------
B15  | $40 | 21.6:1  | 8.4 mo  | -$6,000
B16  | $30 | 28.8:1  | 6.3 mo  | Base
B17  | $25 | 34.6:1  | 5.3 mo  | +$5,000
B18  | $20 | 43.2:1  | 4.2 mo  | +$10,000
```

---

## Sheet 10: KPI DASHBOARD

### A. Financial KPIs
```
Cell | KPI | Current | Target | Status | Trend
-----|-----|---------|--------|--------|-------
B2   | Monthly Revenue | $145,500 | $150,000 | 97% | ↑
B3   | Gross Margin % | 94.0% | 94.0% | 100% | →
B4   | Operating Margin | 23.2% | 25.0% | 93% | ↑
B5   | Cash Balance | $320,000 | $300,000 | 107% | ↑
B6   | Burn Rate | $0 | $0 | N/A | N/A
```

### B. Operational KPIs
```
Cell | KPI | Current | Target | Status | Trend
-----|-----|---------|--------|--------|-------
B9   | Daily Active Users | 850 | 1,000 | 85% | ↑
B10  | Orders per Day | 450 | 500 | 90% | ↑
B11  | Average Order Value | $40 | $42 | 95% | →
B12  | Order Completion Rate | 96% | 95% | 101% | ↑
```

### C. Customer KPIs
```
Cell | KPI | Current | Target | Status | Trend
-----|-----|---------|--------|--------|-------
B15  | New Customers/Month | 350 | 400 | 88% | ↑
B16  | Churn Rate | 4.2% | 4.0% | 95% | ↑
B17  | Customer Lifetime | 19 mos | 20 mos | 95% | ↑
B18  | NPS Score | 52 | 50 | 104% | ↑
```

### D. Growth KPIs
```
Cell | KPI | Current | Target | Status | Trend
-----|-----|---------|--------|--------|-------
B21  | Customer Growth Rate | 16% | 15% | 107% | ↑
B22  | Revenue Growth Rate | 22% | 20% | 110% | ↑
B23  | Market Share | 3.5% | 5.0% | 70% | ↑
B24  | Brand Awareness | 28% | 30% | 93% | ↑
```

---

## CHARTS TO CREATE

### 1. Revenue Growth Chart
- Line chart showing monthly revenue over 24 months
- Three lines: Best, Base, Worst cases

### 2. Customer Acquisition vs Churn
- Bar chart: New customers per month
- Line chart: Churn rate
- Combined chart

### 3. LTV:CAC Trends
- Line chart showing LTV:CAC ratio improvement over time
- Target line at 3:1

### 4. Cost Structure Pie Chart
- Fixed costs breakdown
- Variable costs breakdown

### 5. Breakeven Analysis
- Line chart: Revenue vs Total Costs
- Highlight breakeven point

### 6. Cash Flow Waterfall
- Bar chart showing cumulative cash flow
- Positive/negative color coding

### 7. Scenario Comparison
- Stacked bar chart: Revenue by scenario
- 12-month view

### 8. KPI Dashboard
- Gauge charts for key metrics
- Traffic light indicators (red/yellow/green)

---

## FORMULAS REFERENCE

### Key Formulas Used:

1. **Weighted Average CAC:**
   ```
   =SUMPRODUCT(Range1, Range2)/SUM(Range2)
   ```

2. **LTV Calculation:**
   ```
   =Average_Order_Value * Orders_Per_Month * Gross_Margin * Customer_Lifetime
   ```

3. **LTV:CAC Ratio:**
   ```
   =LTV / CAC
   ```

4. **Payback Period:**
   ```
   =CAC / (Average_Order_Value * Gross_Margin * Orders_Per_Month)
   ```

5. **Breakeven Orders:**
   ```
   =Fixed_Costs / Contribution_Margin_Per_Order
   ```

6. **Churn Rate:**
   ```
   =Customers_Lost / Beginning_Customers
   ```

7. **Compound Monthly Growth:**
   ```
   =Previous_Month * (1 + Growth_Rate)
   ```

8. **Gross Margin:**
   ```
   =(Revenue - COGS) / Revenue
   ```

9. **Operating Margin:**
   ```
   =Operating_Income / Revenue
   ```

10. **Contribution Margin:**
    ```
    =Price - Variable_Costs
    ```

---

## HOW TO USE THIS MODEL

### Step 1: Input Assumptions
- Fill in all yellow-highlighted cells in Sheet 1 (Assumptions)
- Update based on your actual market data

### Step 2: Review Unit Economics
- Check Sheet 2 to ensure LTV:CAC ratios are healthy
- Adjust CAC or pricing if ratios are below 3:1

### Step 3: Set Growth Targets
- Choose Best, Base, or Worst case scenario
- Adjust growth rates in Assumptions sheet

### Step 4: Monitor Breakeven
- Review Sheet 5 to understand when you'll reach profitability
- Adjust fixed costs or pricing if breakeven is too far out

### Step 5: Track KPIs
- Update Sheet 10 monthly with actual results
- Compare against targets

### Step 6: Scenario Planning
- Use Sensitivity Analysis (Sheet 9) to test different scenarios
- Understand impact of key variables

### Step 7: Update Projections
- Refresh all sheets monthly with actual data
- Compare actual vs projected
- Adjust assumptions based on real performance

---

## TROUBLESHOOTING

### Common Issues:

1. **Negative LTV:CAC Ratio:**
   - Check: CAC too high or gross margin too low
   - Fix: Reduce marketing spend or increase prices

2. **Breakeven Too Far Out:**
   - Check: Fixed costs too high or contribution margin too low
   - Fix: Reduce overhead or increase commission rate

3. **Cash Flow Negative:**
   - Check: Spending too fast on growth
   - Fix: Slow growth or raise more capital

4. **Unrealistic Growth:**
   - Check: Growth rates too aggressive
   - Fix: Use more conservative assumptions

---

**Note:** This is a simplified model. For actual financial planning, consult with a CFO or financial advisor. This model should be customized based on your specific business model, market conditions, and cost structure.
