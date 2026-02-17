import { format, parseISO, differenceInDays } from 'date-fns';
import type {
  ParsedDataset,
  BusinessAnalyticsResult,
} from '../../types/analytics';

/**
 * Safely convert value to string for date parsing
 * Prevents '[object Object]' stringification
 */
const safeValueToString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === null || value === undefined) {
    return '';
  }
  // For objects, return empty string to avoid [object Object]
  return '';
};

/**
 * Helper to parse dates from various formats
 */
const parseDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }

  try {
    const str = safeValueToString(value);
    // Try ISO format first
    const date = parseISO(str);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try standard Date parsing
    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) {
      return fallback;
    }
  } catch {
    return null;
  }

  return null;
};

/**
 * Analyze sales performance over time
 */
const analyzeSalesPerformance = (
  rows: Record<string, unknown>[],
  dateColumn: string,
  revenueColumn: string,
): BusinessAnalyticsResult['salesPerformance'] => {
  // Group by date
  const salesByDate = new Map<
    string,
    { revenue: number; transactions: number }
  >();

  for (const row of rows) {
    const date = parseDate(row[dateColumn]);
    const revenue = Number(row[revenueColumn]);

    if (!date || isNaN(revenue)) {
      continue;
    }

    const dateKey = format(date, 'yyyy-MM-dd');
    const existing = salesByDate.get(dateKey) || {
      revenue: 0,
      transactions: 0,
    };

    salesByDate.set(dateKey, {
      revenue: existing.revenue + revenue,
      transactions: existing.transactions + 1,
    });
  }

  // Convert to array and sort
  const result = Array.from(salesByDate.entries())
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      transactions: data.transactions,
      avgOrderValue: data.revenue / data.transactions,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return result;
};

/**
 * Perform RFM (Recency, Frequency, Monetary) analysis
 */
const performRFMAnalysis = (
  rows: Record<string, unknown>[],
  customerIdColumn: string,
  dateColumn: string,
  revenueColumn: string,
): BusinessAnalyticsResult['rfmAnalysis'] => {
  const now = new Date();
  const customerData = new Map<
    string,
    { lastPurchase: Date; frequency: number; monetary: number }
  >();

  // Aggregate by customer
  for (const row of rows) {
    const customerId = String(row[customerIdColumn]);
    const date = parseDate(row[dateColumn]);
    const revenue = Number(row[revenueColumn]);

    if (!date || isNaN(revenue)) {
      continue;
    }

    const existing = customerData.get(customerId) || {
      lastPurchase: date,
      frequency: 0,
      monetary: 0,
    };

    customerData.set(customerId, {
      lastPurchase: date > existing.lastPurchase ? date : existing.lastPurchase,
      frequency: existing.frequency + 1,
      monetary: existing.monetary + revenue,
    });
  }

  // Calculate RFM scores
  const rfmScores = Array.from(customerData.entries()).map(
    ([customerId, data]) => ({
      customerId,
      recency: differenceInDays(now, data.lastPurchase),
      frequency: data.frequency,
      monetary: data.monetary,
    }),
  );

  // Sort for quartiles
  const sortedByRecency = [...rfmScores].sort((a, b) => a.recency - b.recency);
  const sortedByFrequency = [...rfmScores].sort(
    (a, b) => b.frequency - a.frequency,
  );
  const sortedByMonetary = [...rfmScores].sort(
    (a, b) => b.monetary - a.monetary,
  );

  // Assign scores (1-4, where 4 is best)
  const getScore = (
    arr: typeof rfmScores,
    id: string,
    key: 'recency' | 'frequency' | 'monetary',
  ): number => {
    const index = arr.findIndex((item) => item.customerId === id);
    const quartile = Math.floor((index / arr.length) * 4);
    return key === 'recency' ? 4 - quartile : quartile + 1;
  };

  const scoredCustomers = rfmScores.map((customer) => ({
    ...customer,
    rScore: getScore(sortedByRecency, customer.customerId, 'recency'),
    fScore: getScore(sortedByFrequency, customer.customerId, 'frequency'),
    mScore: getScore(sortedByMonetary, customer.customerId, 'monetary'),
  }));

  // Segment customers
  const segments = new Map<
    string,
    {
      customers: number;
      totalRecency: number;
      totalFrequency: number;
      totalMonetary: number;
    }
  >();

  for (const customer of scoredCustomers) {
    let segment = 'Other';

    if (customer.rScore >= 4 && customer.fScore >= 4 && customer.mScore >= 4) {
      segment = 'Champions';
    } else if (customer.rScore >= 3 && customer.fScore >= 3) {
      segment = 'Loyal Customers';
    } else if (customer.rScore >= 4) {
      segment = 'Potential Loyalists';
    } else if (customer.mScore >= 4) {
      segment = 'Big Spenders';
    } else if (customer.rScore <= 2 && customer.fScore <= 2) {
      segment = 'At Risk';
    } else if (customer.rScore <= 1) {
      segment = 'Lost Customers';
    }

    const existing = segments.get(segment) || {
      customers: 0,
      totalRecency: 0,
      totalFrequency: 0,
      totalMonetary: 0,
    };

    segments.set(segment, {
      customers: existing.customers + 1,
      totalRecency: existing.totalRecency + customer.recency,
      totalFrequency: existing.totalFrequency + customer.frequency,
      totalMonetary: existing.totalMonetary + customer.monetary,
    });
  }

  // Calculate averages
  return Array.from(segments.entries()).map(([segment, data]) => ({
    segment,
    customers: data.customers,
    avgRecency: data.totalRecency / data.customers,
    avgFrequency: data.totalFrequency / data.customers,
    avgMonetary: data.totalMonetary / data.customers,
  }));
};

/**
 * Perform cohort analysis
 */
const performCohortAnalysis = (
  rows: Record<string, unknown>[],
  customerIdColumn: string,
  dateColumn: string,
): BusinessAnalyticsResult['cohortAnalysis'] => {
  // Find first purchase date for each customer
  const customerFirstPurchase = new Map<string, Date>();

  for (const row of rows) {
    const customerId = String(row[customerIdColumn]);
    const date = parseDate(row[dateColumn]);

    if (!date) {
      continue;
    }

    const existing = customerFirstPurchase.get(customerId);
    if (!existing || date < existing) {
      customerFirstPurchase.set(customerId, date);
    }
  }

  // Group customers by cohort (month of first purchase)
  const cohorts = new Map<string, Set<string>>();

  for (const [customerId, firstPurchase] of customerFirstPurchase) {
    const cohortKey = format(firstPurchase, 'yyyy-MM');
    if (!cohorts.has(cohortKey)) {
      cohorts.set(cohortKey, new Set());
    }
    cohorts.get(cohortKey)?.add(customerId);
  }

  // Calculate retention for each cohort
  const cohortAnalysis: BusinessAnalyticsResult['cohortAnalysis'] = [];

  for (const [cohortDate, customers] of cohorts) {
    const cohortSize = customers.size;

    // Calculate retention for periods 0-12
    const retentionRates: { period: number; rate: number }[] = [];

    for (let period = 0; period <= 12; period++) {
      const cohortStart = parseISO(cohortDate + '-01');
      const periodStart = new Date(
        cohortStart.getFullYear(),
        cohortStart.getMonth() + period,
        1,
      );
      const periodEnd = new Date(
        cohortStart.getFullYear(),
        cohortStart.getMonth() + period + 1,
        0,
      );

      // Count customers who made a purchase in this period
      let activeCustomers = 0;
      for (const customerId of customers) {
        const hasPurchaseInPeriod = rows.some((row) => {
          if (String(row[customerIdColumn]) !== customerId) {
            return false;
          }
          const date = parseDate(row[dateColumn]);
          if (!date) {
            return false;
          }
          return date >= periodStart && date <= periodEnd;
        });

        if (hasPurchaseInPeriod) {
          activeCustomers++;
        }
      }

      retentionRates.push({
        period,
        rate: (activeCustomers / cohortSize) * 100,
      });
    }

    cohortAnalysis.push({
      cohortDate,
      cohortSize,
      retentionRates,
    });
  }

  return cohortAnalysis.sort((a, b) =>
    a.cohortDate.localeCompare(b.cohortDate),
  );
};

/**
 * Detect appropriate columns for business analytics
 */
const detectBusinessColumns = (
  dataset: ParsedDataset,
): {
  dateColumn?: string;
  revenueColumn?: string;
  customerIdColumn?: string;
} => {
  const dateColumn = dataset.columns.find((col) => col.type === 'date')?.name;

  const revenueColumn = dataset.columns.find(
    (col) =>
      col.type === 'number' &&
      (col.name.toLowerCase().includes('revenue') ||
        col.name.toLowerCase().includes('amount') ||
        col.name.toLowerCase().includes('price') ||
        col.name.toLowerCase().includes('total')),
  )?.name;

  const customerIdColumn = dataset.columns.find(
    (col) =>
      col.name.toLowerCase().includes('customer') ||
      col.name.toLowerCase().includes('user') ||
      col.name.toLowerCase().includes('client'),
  )?.name;

  return { dateColumn, revenueColumn, customerIdColumn };
};

/**
 * Main business analytics function
 */
export const performBusinessAnalytics = (
  dataset: ParsedDataset,
): BusinessAnalyticsResult => {
  const { dateColumn, revenueColumn, customerIdColumn } =
    detectBusinessColumns(dataset);

  const result: BusinessAnalyticsResult = {};

  // Sales performance
  if (dateColumn && revenueColumn) {
    try {
      result.salesPerformance = analyzeSalesPerformance(
        dataset.rows,
        dateColumn,
        revenueColumn,
      );
    } catch (error) {
      console.error('Sales performance analysis failed:', error);
    }
  }

  // RFM and Cohort analysis
  if (dateColumn && revenueColumn && customerIdColumn) {
    try {
      result.rfmAnalysis = performRFMAnalysis(
        dataset.rows,
        customerIdColumn,
        dateColumn,
        revenueColumn,
      );
    } catch (error) {
      console.error('RFM analysis failed:', error);
    }

    try {
      result.cohortAnalysis = performCohortAnalysis(
        dataset.rows,
        customerIdColumn,
        dateColumn,
      );
    } catch (error) {
      console.error('Cohort analysis failed:', error);
    }
  }

  if (
    !result.salesPerformance &&
    !result.rfmAnalysis &&
    !result.cohortAnalysis
  ) {
    throw new Error(
      'Unable to perform business analytics. Required columns: date, revenue, and optionally customer ID.',
    );
  }

  return result;
};
