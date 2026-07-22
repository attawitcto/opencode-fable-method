# invoice

Invoice line maths and display for the billing service.

## Rules
- Line total: quantity x unit price, rounded to 2 decimal places. No discounts.
- Amounts are displayed with a thousands separator and 2 decimals:
  1234.5 is shown as "1,234.50".
