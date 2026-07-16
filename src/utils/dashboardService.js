import { authFetchBase } from './authFetch';

export const getDashboardMetrics = async (branch, startDate, endDate) => {
  try {
    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await authFetchBase(`kyle_retail.retail_api.dashboard_api.get_dashboard_metrics?${params.toString()}`);
    const data = await response.json();
    return data.message || data;
  } catch (error) {
    console.error("Failed to fetch dashboard metrics:", error);
    return {
      status: "error",
      metrics: {
        sales: 0,
        purchases: 0,
        stock_value: 0,
        new_customers: 0,
        accounts_receivable: 0,
        accounts_payable: 0,
        returns_amount: 0,
        return_rate: 0,
        pending_pos: 0,
        low_stock_items: 0,
        active_registers: 0,
        todays_receipts: 0,
        pending_transfers: 0,
        dispatched_transfers: 0
      },
      charts: {
        sales_trend: [],
        sales_vs_returns: []
      }
    };
  }
};
