export const FINANCIAL_DATA_CHANGED = 'bocor-halus:financial-data-changed';

export const notifyFinancialDataChanged = () => {
  window.dispatchEvent(new Event(FINANCIAL_DATA_CHANGED));
};
