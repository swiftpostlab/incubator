import * as stats from 'simple-statistics';
import type {
  ParsedDataset,
  StatisticalAnalysisResult,
  DataColumn,
} from '../../types/analytics';

/**
 * Calculate descriptive statistics for a numeric column
 */
const calculateDescriptiveStats = (
  column: DataColumn,
  values: number[],
): StatisticalAnalysisResult['descriptiveStats'][0] => {
  if (values.length === 0) {
    throw new Error(`No valid numeric values in column ${column.name}`);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = stats.mean(values);
  const median = stats.median(values);
  const mode = stats.mode(values);
  const stdDev = stats.standardDeviation(values);
  const variance = stats.variance(values);
  const min = stats.min(values);
  const max = stats.max(values);
  const q1 = stats.quantile(sorted, 0.25);
  const q3 = stats.quantile(sorted, 0.75);
  const iqr = q3 - q1;

  // Calculate skewness and kurtosis
  const n = values.length;
  const m2 = stats.sumNthPowerDeviations(values, 2) / n;
  const m3 = stats.sumNthPowerDeviations(values, 3) / n;
  const m4 = stats.sumNthPowerDeviations(values, 4) / n;

  const skewness = m3 / Math.pow(m2, 1.5);
  const kurtosis = m4 / Math.pow(m2, 2) - 3;

  return {
    column: column.name,
    mean,
    median,
    mode: Array.isArray(mode) ? mode : [mode],
    stdDev,
    variance,
    min,
    max,
    q1,
    q3,
    iqr,
    skewness,
    kurtosis,
  };
};

/**
 * Calculate correlation between two numeric columns
 */
const calculateCorrelation = (
  col1: DataColumn,
  col2: DataColumn,
  values1: number[],
  values2: number[],
): {
  column1: string;
  column2: string;
  pearson: number;
  spearman: number;
} => {
  // Ensure equal length and pair up values
  const pairs: Array<[number, number]> = [];
  const minLength = Math.min(values1.length, values2.length);

  for (let i = 0; i < minLength; i++) {
    pairs.push([values1[i], values2[i]]);
  }

  if (pairs.length < 2) {
    return {
      column1: col1.name,
      column2: col2.name,
      pearson: 0,
      spearman: 0,
    };
  }

  const x = pairs.map((p) => p[0]);
  const y = pairs.map((p) => p[1]);

  // Pearson correlation
  const pearson = stats.sampleCorrelation(x, y);

  // Spearman (rank correlation) - convert to ranks
  const rankX = getRanks(x);
  const rankY = getRanks(y);
  const spearman = stats.sampleCorrelation(rankX, rankY);

  return {
    column1: col1.name,
    column2: col2.name,
    pearson: isNaN(pearson) ? 0 : pearson,
    spearman: isNaN(spearman) ? 0 : spearman,
  };
};

/**
 * Convert values to ranks for Spearman correlation
 */
const getRanks = (values: number[]): number[] => {
  const sorted = values
    .map((val, idx) => ({ val, idx }))
    .sort((a, b) => a.val - b.val);

  const ranks = new Array<number>(values.length);
  for (let i = 0; i < sorted.length; i++) {
    ranks[sorted[i].idx] = i + 1;
  }
  return ranks;
};

/**
 * Create histogram bins for a distribution
 */
const createHistogram = (
  values: number[],
  binCount: number = 20,
): { bin: string; count: number }[] => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / binCount;

  const bins: { bin: string; count: number }[] = [];

  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binWidth;
    const binEnd = binStart + binWidth;
    const count = values.filter((v) => v >= binStart && v < binEnd).length;

    bins.push({
      bin: `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`,
      count,
    });
  }

  return bins;
};

/**
 * Test for normality using Shapiro-Wilk approximation
 * For large samples, this is approximate
 */
const testNormality = (
  values: number[],
): { isNormal: boolean; statistic: number; pValue: number } => {
  // Simplified normality test based on skewness and kurtosis
  const n = values.length;
  // const mean = stats.mean(values);
  const stdDev = stats.standardDeviation(values);

  const m3 = stats.sumNthPowerDeviations(values, 3) / n;
  const m4 = stats.sumNthPowerDeviations(values, 4) / n;

  const skewness = m3 / Math.pow(stdDev, 3);
  const kurtosis = m4 / Math.pow(stdDev, 4) - 3;

  // Jarque-Bera test statistic
  const jb = (n / 6) * (Math.pow(skewness, 2) + Math.pow(kurtosis, 2) / 4);

  // Approximate p-value (chi-square with 2 df)
  const pValue = 1 - Math.exp(-jb / 2);

  return {
    isNormal: pValue > 0.05,
    statistic: jb,
    pValue,
  };
};

/**
 * Extract numeric values from column
 */
const getNumericValues = (
  rows: Record<string, unknown>[],
  columnName: string,
): number[] => {
  return rows
    .map((row) => {
      const value = row[columnName];
      if (value === null || value === undefined) {
        return null;
      }
      const num = Number(value);
      return isNaN(num) ? null : num;
    })
    .filter((v): v is number => v !== null);
};

/**
 * Main statistical analysis function
 */
export const performStatisticalAnalysis = (
  dataset: ParsedDataset,
): StatisticalAnalysisResult => {
  const numericColumns = dataset.columns.filter((col) => col.type === 'number');

  if (numericColumns.length === 0) {
    throw new Error('No numeric columns found for statistical analysis');
  }

  // Calculate descriptive statistics
  const descriptiveStats = numericColumns.map((col) => {
    const values = getNumericValues(dataset.rows, col.name);
    return calculateDescriptiveStats(col, values);
  });

  // Calculate correlations (only if 2+ numeric columns)
  let correlations: StatisticalAnalysisResult['correlations'] = undefined;
  if (numericColumns.length >= 2) {
    correlations = [];
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const values1 = getNumericValues(dataset.rows, numericColumns[i].name);
        const values2 = getNumericValues(dataset.rows, numericColumns[j].name);

        correlations.push(
          calculateCorrelation(
            numericColumns[i],
            numericColumns[j],
            values1,
            values2,
          ),
        );
      }
    }
  }

  // Create distributions
  const distributions = numericColumns.map((col) => {
    const values = getNumericValues(dataset.rows, col.name);
    const histogram = createHistogram(values);
    const normalityTest = testNormality(values);

    return {
      column: col.name,
      histogram,
      isNormal: normalityTest.isNormal,
      normalityTest: {
        statistic: normalityTest.statistic,
        pValue: normalityTest.pValue,
      },
    };
  });

  return {
    descriptiveStats,
    correlations,
    distributions,
  };
};
