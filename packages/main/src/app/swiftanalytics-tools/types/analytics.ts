// Core data types for SwiftAnalytics

export type FileFormat = 'csv' | 'excel' | 'json';

export type ColumnType = 'string' | 'number' | 'date' | 'boolean' | 'mixed';

export interface DataColumn {
  name: string;
  type: ColumnType;
  originalName: string;
  sampleValues: unknown[];
  uniqueCount: number;
  nullCount: number;
  nullPercentage: number;
}

export interface ParsedDataset {
  id: string;
  fileName: string;
  fileSize: number;
  format: FileFormat;
  rows: Record<string, unknown>[];
  columns: DataColumn[];
  rowCount: number;
  uploadedAt: Date;
  processingTime: number;
}

export type AnalysisType =
  | 'statistical'
  | 'data-quality'
  | 'business'
  | 'time-series';

export interface AnalysisConfig {
  type: AnalysisType;
  name: string;
  description: string;
  icon: string;
  requiredColumns: {
    numeric?: number;
    date?: number;
    any?: number;
  };
}

export interface StatisticalAnalysisResult {
  descriptiveStats: {
    column: string;
    mean: number;
    median: number;
    mode: number[];
    stdDev: number;
    variance: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    iqr: number;
    skewness: number;
    kurtosis: number;
  }[];
  correlations?: {
    column1: string;
    column2: string;
    pearson: number;
    spearman: number;
  }[];
  distributions: {
    column: string;
    histogram: { bin: string; count: number }[];
    isNormal: boolean;
    normalityTest?: {
      statistic: number;
      pValue: number;
    };
  }[];
}

export interface DataQualityResult {
  overview: {
    totalRows: number;
    totalColumns: number;
    memoryUsage: number;
    completeness: number;
  };
  columnProfiles: {
    column: string;
    type: ColumnType;
    uniqueValues: number;
    uniquePercentage: number;
    missingCount: number;
    missingPercentage: number;
    mostCommon?: { value: unknown; count: number }[];
  }[];
  outliers: {
    column: string;
    method: 'iqr' | 'zscore';
    outlierCount: number;
    outlierPercentage: number;
    outlierValues: { index: number; value: number }[];
  }[];
  duplicates: {
    duplicateRowCount: number;
    duplicatePercentage: number;
    duplicateRows: number[];
  };
}

export interface BusinessAnalyticsResult {
  cohortAnalysis?: {
    cohortDate: string;
    cohortSize: number;
    retentionRates: { period: number; rate: number }[];
  }[];
  rfmAnalysis?: {
    segment: string;
    customers: number;
    avgRecency: number;
    avgFrequency: number;
    avgMonetary: number;
  }[];
  salesPerformance?: {
    date: string;
    revenue: number;
    transactions: number;
    avgOrderValue: number;
  }[];
  customerSegmentation?: {
    segment: string;
    size: number;
    characteristics: Record<string, unknown>;
  }[];
}

export interface TimeSeriesResult {
  trends: {
    date: string;
    value: number;
    movingAverage?: number;
    trend?: number;
  }[];
  seasonality?: {
    pattern: string;
    strength: number;
  };
  forecast?: {
    date: string;
    predicted: number;
    lowerBound: number;
    upperBound: number;
  }[];
  decomposition?: {
    date: string;
    observed: number;
    trend: number;
    seasonal: number;
    residual: number;
  }[];
}

export type AnalysisResult =
  | { type: 'statistical'; data: StatisticalAnalysisResult }
  | { type: 'data-quality'; data: DataQualityResult }
  | { type: 'business'; data: BusinessAnalyticsResult }
  | { type: 'time-series'; data: TimeSeriesResult };

export interface AnalysisJob {
  id: string;
  datasetId: string;
  analysisType: AnalysisType;
  config: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: AnalysisResult;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}
