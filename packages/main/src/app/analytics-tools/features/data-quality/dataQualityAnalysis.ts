import * as stats from 'simple-statistics';
import type { ParsedDataset, DataQualityResult } from '../../types/analytics';

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
 * Calculate overall data quality metrics
 */
const calculateOverview = (
  dataset: ParsedDataset,
): DataQualityResult['overview'] => {
  const totalCells = dataset.rowCount * dataset.columns.length;
  const totalNulls = dataset.columns.reduce(
    (sum, col) => sum + col.nullCount,
    0,
  );
  const completeness = ((totalCells - totalNulls) / totalCells) * 100;

  // Estimate memory usage (rough approximation)
  const memoryUsage = dataset.fileSize;

  return {
    totalRows: dataset.rowCount,
    totalColumns: dataset.columns.length,
    memoryUsage,
    completeness,
  };
};

/**
 * Create detailed column profiles
 */
const createColumnProfiles = (
  dataset: ParsedDataset,
): DataQualityResult['columnProfiles'] => {
  return dataset.columns.map((col) => {
    const values = dataset.rows.map((row) => row[col.name]);
    const nonNullValues = values.filter((v) => v !== null && v !== undefined);

    // Find most common values
    const valueCounts = new Map<unknown, number>();
    for (const value of nonNullValues) {
      const key = safeValueToString(value);
      valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
    }

    const mostCommon = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));

    return {
      column: col.name,
      type: col.type,
      uniqueValues: col.uniqueCount,
      uniquePercentage: (col.uniqueCount / dataset.rowCount) * 100,
      missingCount: col.nullCount,
      missingPercentage: col.nullPercentage,
      mostCommon: mostCommon.length > 0 ? mostCommon : undefined,
    };
  });
};

/**
 * Detect outliers using IQR method
 */
const detectOutliersIQR = (
  values: number[],
): { outlierIndices: number[]; lowerBound: number; upperBound: number } => {
  if (values.length < 4) {
    return { outlierIndices: [], lowerBound: 0, upperBound: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = stats.quantile(sorted, 0.25);
  const q3 = stats.quantile(sorted, 0.75);
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outlierIndices: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lowerBound || values[i] > upperBound) {
      outlierIndices.push(i);
    }
  }

  return { outlierIndices, lowerBound, upperBound };
};

/**
 * Detect outliers using Z-score method
 */
const detectOutliersZScore = (
  values: number[],
  threshold: number = 3,
): number[] => {
  if (values.length < 2) {
    return [];
  }

  const mean = stats.mean(values);
  const stdDev = stats.standardDeviation(values);

  if (stdDev === 0) {
    return [];
  }

  const outlierIndices: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const zScore = Math.abs((values[i] - mean) / stdDev);
    if (zScore > threshold) {
      outlierIndices.push(i);
    }
  }

  return outlierIndices;
};

/**
 * Get numeric values with their original indices
 */
const getNumericValuesWithIndices = (
  rows: Record<string, unknown>[],
  columnName: string,
): Array<{ value: number; index: number }> => {
  const result: Array<{ value: number; index: number }> = [];

  for (let i = 0; i < rows.length; i++) {
    const value = rows[i][columnName];
    if (value !== null && value !== undefined) {
      const num = Number(value);
      if (!isNaN(num)) {
        result.push({ value: num, index: i });
      }
    }
  }

  return result;
};

/**
 * Detect outliers in numeric columns
 */
const detectOutliers = (
  dataset: ParsedDataset,
): DataQualityResult['outliers'] => {
  const numericColumns = dataset.columns.filter((col) => col.type === 'number');

  return numericColumns.flatMap((col) => {
    const valuesWithIndices = getNumericValuesWithIndices(
      dataset.rows,
      col.name,
    );
    const values = valuesWithIndices.map((v) => v.value);

    if (values.length < 4) {
      return [];
    }

    // Use both methods
    const iqrResult = detectOutliersIQR(values);
    const zScoreIndices = detectOutliersZScore(values);

    // IQR method
    const iqrOutliers = iqrResult.outlierIndices
      .slice(0, 10)
      .map((idx) => valuesWithIndices[idx]);

    // Z-score method
    const zScoreOutliers = zScoreIndices
      .slice(0, 10)
      .map((idx) => valuesWithIndices[idx]);

    return [
      {
        column: col.name,
        method: 'iqr' as const,
        outlierCount: iqrResult.outlierIndices.length,
        outlierPercentage:
          (iqrResult.outlierIndices.length / values.length) * 100,
        outlierValues: iqrOutliers,
      },
      {
        column: col.name,
        method: 'zscore' as const,
        outlierCount: zScoreIndices.length,
        outlierPercentage: (zScoreIndices.length / values.length) * 100,
        outlierValues: zScoreOutliers,
      },
    ];
  });
};

/**
 * Detect duplicate rows
 */
const detectDuplicates = (
  dataset: ParsedDataset,
): DataQualityResult['duplicates'] => {
  const rowHashes = new Map<string, number[]>();

  // Create hash for each row
  for (let i = 0; i < dataset.rows.length; i++) {
    const row = dataset.rows[i];
    const hash = JSON.stringify(
      Object.entries(row).sort((a, b) => a[0].localeCompare(b[0])),
    );

    if (!rowHashes.has(hash)) {
      rowHashes.set(hash, []);
    }
    rowHashes.get(hash)?.push(i);
  }

  // Find duplicates
  const duplicateRows: number[] = [];
  for (const indices of rowHashes.values()) {
    if (indices.length > 1) {
      // Keep first occurrence, mark rest as duplicates
      duplicateRows.push(...indices.slice(1));
    }
  }

  return {
    duplicateRowCount: duplicateRows.length,
    duplicatePercentage: (duplicateRows.length / dataset.rowCount) * 100,
    duplicateRows: duplicateRows.slice(0, 100), // Return first 100
  };
};

/**
 * Main data quality analysis function
 */
export const performDataQualityAnalysis = (
  dataset: ParsedDataset,
): DataQualityResult => {
  return {
    overview: calculateOverview(dataset),
    columnProfiles: createColumnProfiles(dataset),
    outliers: detectOutliers(dataset),
    duplicates: detectDuplicates(dataset),
  };
};
