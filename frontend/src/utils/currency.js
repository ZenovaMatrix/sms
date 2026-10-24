/**
 * Currency and Financial Formatting Utility
 * Uses Indian Rupee (INR - ₹) formatting standard across EduManage.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrNoDecimalsFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a number or numeric string as INR (e.g. ₹1,25,000.00)
 * @param {number|string} amount
 * @param {boolean} [showDecimals=true]
 * @returns {string}
 */
export function formatINR(amount, showDecimals = true) {
  const numeric = Number(amount);
  if (isNaN(numeric) || amount === null || amount === undefined) {
    return showDecimals ? '₹0.00' : '₹0';
  }
  return showDecimals ? inrFormatter.format(numeric) : inrNoDecimalsFormatter.format(numeric);
}

/**
 * Parse an amount safely to 2 decimal places
 * @param {number|string} amount
 * @returns {number}
 */
export function roundToCurrency(amount) {
  const numeric = Number(amount);
  if (isNaN(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}
