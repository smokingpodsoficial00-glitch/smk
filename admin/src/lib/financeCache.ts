export interface FinanceDataCache {
  companyId: string;
  timestamp: number;
  data: {
    persistedCosts: Record<string, number>;
    rawOrders: any[];
    productsData: any[];
    repurchases: any[];
    partnerTxs: any[];
    partners: any[];
  };
}

let _financeSessionCache: FinanceDataCache | null = null;
export const FINANCE_CACHE_TTL_MS = 30 * 1000; // 30 segundos

export const getFinanceSessionCache = (): FinanceDataCache | null => _financeSessionCache;

export const setFinanceSessionCache = (cache: FinanceDataCache | null) => {
  _financeSessionCache = cache;
};

export const invalidateFinanceCache = (_companyId?: string | null) => {
  _financeSessionCache = null;
};
