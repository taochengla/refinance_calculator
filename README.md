# Refinance Calculator

A web application to help homeowners compare mortgage refinancing options.

## Features

- **Side-by-side comparison**: Compare current vs. refinanced mortgage scenarios.
- **Visual charts**: Interactive line chart showing balance over time and bar charts for monthly payment, total interest, and payoff time.
- **Detailed breakdown**: View the first 12 months of the amortization schedule for both loans.
- **Break-even analysis**: Calculate how long it takes for the savings to offset the refinance costs.
- **Responsive design**: Optimized for both desktop and mobile devices.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/taochengla/refinance_calculator.git
   cd refinance_calculator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Usage

1. Start the development server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to `http://localhost:3000`.

## How It Works

The application uses a simple amortization formula to calculate loan payments:

- **Interest per month**: `balance * (annual_rate / 12)`
- **Principal paid**: `monthly_payment - interest`
- **New balance**: `balance - principal_paid`

The frontend calculates and displays:
- Total interest paid over the life of the loan.
- Total amount paid.
- Payoff time in months and years.
- Break-even point in months.

## License

This project is licensed under the MIT License.