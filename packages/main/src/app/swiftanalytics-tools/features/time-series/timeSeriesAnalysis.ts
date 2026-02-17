import { parseISO, format, addDays } from 'date-fns';
import * as stats from 'simple-statistics';
import type { ParsedDataset, TimeSeriesResult } from '../../types/analytics';

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
 * Parse date from various formats
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
    if (!str) {
      return null;
    }

    const date = parseISO(str);
    if (!isNaN(date.getTime())) {
      return date;
    }

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
 * Calculate moving average
 */
const calculateMovingAverage = (
  values: number[],
  windowSize: number,
): (number | null)[] => {
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < windowSize - 1) {
      result.push(null);
      continue;
    }

    const window = values.slice(i - windowSize + 1, i + 1);
    result.push(stats.mean(window));
  }

  return result;
};

/**
 * Calculate linear trend
 */
const calculateTrend = (values: number[]): number[] => {
  const x = Array.from({ length: values.length }, (_, i) => i);
  const pairs: Array<[number, number]> = x.map((xi, i) => [xi, values[i]]);
  const linearRegression = stats.linearRegression(pairs);

  return x.map((xi) => stats.linearRegressionLine(linearRegression)(xi));
};

/**
 * Detect seasonality in time series
 */
const detectSeasonality = (
  values: number[],
): TimeSeriesResult['seasonality'] => {
  if (values.length < 24) {
    return undefined;
  }

  // Check for common periods: 7 (weekly), 30 (monthly), 365 (yearly)
  const periods = [7, 30, 365];
  let maxCorrelation = 0;
  let bestPeriod = 0;

  for (const period of periods) {
    if (period >= values.length) {
      continue;
    }

    // Calculate autocorrelation at this lag
    const lagged = values.slice(period);
    const original = values.slice(0, -period);

    if (lagged.length < 2) {
      continue;
    }

    try {
      const correlation = Math.abs(stats.sampleCorrelation(original, lagged));
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    } catch {
      continue;
    }
  }

  if (maxCorrelation > 0.3) {
    const patterns: Record<number, string> = {
      7: 'Weekly',
      30: 'Monthly',
      365: 'Yearly',
    };

    return {
      pattern: patterns[bestPeriod] || `${bestPeriod}-day cycle`,
      strength: maxCorrelation,
    };
  }

  return undefined;
};

/**
 * Simple linear forecast
 */
const forecastLinear = (
  values: number[],
  dates: Date[],
  periodsAhead: number,
): TimeSeriesResult['forecast'] => {
  // Calculate linear regression
  const x = Array.from({ length: values.length }, (_, i) => i);
  const points: Array<[number, number]> = x.map((xi, i) => [xi, values[i]]);
  const linearRegression = stats.linearRegression(points);
  const line = stats.linearRegressionLine(linearRegression);

  // Calculate standard error for confidence intervals
  const residuals = values.map((y, i) => y - line(i));
  const stdError = stats.standardDeviation(residuals);

  // Generate forecasts
  const lastDate = dates[dates.length - 1];
  const forecasts: TimeSeriesResult['forecast'] = [];

  for (let i = 1; i <= periodsAhead; i++) {
    const futureDate = addDays(lastDate, i);
    const predicted = line(values.length + i - 1);

    // 95% confidence interval (approximately 2 standard errors)
    const margin = 1.96 * stdError;

    forecasts.push({
      date: format(futureDate, 'yyyy-MM-dd'),
      predicted,
      lowerBound: predicted - margin,
      upperBound: predicted + margin,
    });
  }

  return forecasts;
};

/**
 * Simple seasonal decomposition
 */
const decomposeTimeSeries = (
  values: number[],
  dates: Date[],
  period?: number,
): TimeSeriesResult['decomposition'] => {
  if (!period || period >= values.length) {
    return undefined;
  }

  // Calculate trend using moving average
  const trend = calculateMovingAverage(values, period);

  // Calculate seasonal component - remove trend
  // cSpell:ignore detrended
  const detrended = values.map((v, i) => {
    const trendValue = trend[i];
    return trendValue !== null ? v - trendValue : null;
  });

  // Average seasonal pattern
  const seasonalPattern: number[] = [];
  for (let i = 0; i < period; i++) {
    const seasonalValues: number[] = [];
    for (let j = i; j < detrended.length; j += period) {
      const detrendedValue = detrended[j];
      if (detrendedValue !== null) {
        seasonalValues.push(detrendedValue);
      }
    }
    seasonalPattern.push(
      seasonalValues.length > 0 ? stats.mean(seasonalValues) : 0,
    );
  }

  // Calculate residuals
  const decomposition: TimeSeriesResult['decomposition'] = [];

  for (let i = 0; i < values.length; i++) {
    const seasonal = seasonalPattern[i % period];
    const trendValue = trend[i] || stats.mean(values);

    decomposition.push({
      date: format(dates[i], 'yyyy-MM-dd'),
      observed: values[i],
      trend: trendValue,
      seasonal,
      residual: values[i] - trendValue - seasonal,
    });
  }

  return decomposition;
};

/**
 * Detect appropriate columns for time series analysis
 */
const detectTimeSeriesColumns = (
  dataset: ParsedDataset,
): { dateColumn?: string; valueColumn?: string } => {
  const dateColumn = dataset.columns.find((col) => col.type === 'date')?.name;

  const valueColumn = dataset.columns.find(
    (col) =>
      col.type === 'number' &&
      !col.name.toLowerCase().includes('id') &&
      !col.name.toLowerCase().includes('count'),
  )?.name;

  return { dateColumn, valueColumn };
};

/**
 * Main time series analysis function
 */
export const performTimeSeriesAnalysis = (
  dataset: ParsedDataset,
): TimeSeriesResult => {
  const { dateColumn, valueColumn } = detectTimeSeriesColumns(dataset);

  if (!dateColumn || !valueColumn) {
    throw new Error(
      'Time series analysis requires a date column and a numeric value column.',
    );
  }

  // Extract and sort data by date
  const timeSeriesData = dataset.rows
    .map((row) => ({
      date: parseDate(row[dateColumn]),
      value: Number(row[valueColumn]),
    }))
    .filter(
      (d): d is { date: Date; value: number } =>
        d.date !== null && !isNaN(d.value),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (timeSeriesData.length < 2) {
    throw new Error('Insufficient data for time series analysis.');
  }

  const dates = timeSeriesData.map((d) => d.date);
  const values = timeSeriesData.map((d) => d.value);

  // Calculate moving average (7-day window)
  const windowSize = Math.min(7, Math.floor(values.length / 3));
  const movingAvg = calculateMovingAverage(values, windowSize);

  // Calculate trend
  const trend = calculateTrend(values);

  // Build trends array
  const trends: TimeSeriesResult['trends'] = timeSeriesData.map((d, i) => ({
    date: format(d.date, 'yyyy-MM-dd'),
    value: d.value,
    movingAverage: movingAvg[i] || undefined,
    trend: trend[i],
  }));

  // Detect seasonality
  const seasonality = detectSeasonality(values);

  // Generate forecast (30 days ahead)
  const forecastPeriods = Math.min(30, Math.floor(values.length * 0.2));
  const forecast = forecastLinear(values, dates, forecastPeriods);

  // Decompose if seasonality detected
  const decomposition =
    seasonality ?
      decomposeTimeSeries(
        values,
        dates,
        seasonality.pattern === 'Weekly' ? 7 : 30,
      )
    : undefined;

  return {
    trends,
    seasonality,
    forecast,
    decomposition,
  };
};
