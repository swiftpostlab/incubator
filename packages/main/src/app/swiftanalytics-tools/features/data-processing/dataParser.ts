import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import type {
  FileFormat,
  ParsedDataset,
  DataColumn,
  ColumnType,
} from '../../types/analytics';

/**
 * Data Parser Module
 *
 * Note: This module uses external libraries (papaparse, xlsx) that have
 * loose type definitions. We use type guards and explicit type assertions
 * to ensure type safety at runtime, with targeted eslint-disable comments
 * only for the library calls themselves (which we cannot fix).
 */

// Zod schema for validation
const DatasetSchema = z.object({
  rows: z.array(z.record(z.unknown())),
  columns: z.array(z.string()),
});

/**
 * Safely convert value to string for date parsing
 */
const safeToString = (value: unknown): string => {
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
 * Detect the type of a column based on sample values
 */
const detectColumnType = (values: unknown[]): ColumnType => {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined);

  if (nonNullValues.length === 0) {
    return 'mixed';
  }

  let numCount = 0;
  let dateCount = 0;
  let boolCount = 0;

  for (const value of nonNullValues.slice(0, 100)) {
    // Sample first 100
    if (typeof value === 'number' || !isNaN(Number(value))) {
      numCount++;
    }
    const strValue = safeToString(value);
    if (strValue && (value instanceof Date || !isNaN(Date.parse(strValue)))) {
      dateCount++;
    }
    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      boolCount++;
    }
  }

  const total = nonNullValues.length;
  if (numCount / total > 0.8) {
    return 'number';
  }
  if (dateCount / total > 0.8) {
    return 'date';
  }
  if (boolCount / total > 0.8) {
    return 'boolean';
  }
  if (numCount > 0 && dateCount > 0) {
    return 'mixed';
  }

  return 'string';
};

/**
 * Type guard for Papa.parse CSV data results
 */
const isValidPapaParseData = (
  data: unknown,
): data is Record<string, unknown>[] => {
  return Array.isArray(data) && data.length > 0;
};

/**
 * Type guard for Papa.parse CSV column fields
 */
const isValidPapaParseFields = (fields: unknown): fields is string[] => {
  return (
    Array.isArray(fields) &&
    fields.length > 0 &&
    fields.every((f) => typeof f === 'string')
  );
};

/**
 * Parse CSV file using PapaParse
 */
const parseCSV = (
  file: File,
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results: { data: unknown; meta: { fields?: unknown } }) => {
        try {
          // Type guard the data
          if (!isValidPapaParseData(results.data)) {
            throw new Error('CSV file contains no valid data');
          }

          // Type guard the fields
          const fields = results.meta.fields;
          if (!isValidPapaParseFields(fields)) {
            throw new Error('CSV file has no valid column headers');
          }

          resolve({ rows: results.data, columns: fields });
        } catch (_err) {
          reject(new Error('Failed to parse CSV data'));
        }
      },
      error: (err: { message: string }) => {
        reject(new Error(`CSV parsing error: ${err.message}`));
      },
    });
  });
};

/**
 * Type guard for XLSX workbook structure
 */
const isValidXLSXWorkbook = (
  workbook: unknown,
): workbook is {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
} => {
  return (
    typeof workbook === 'object' &&
    workbook !== null &&
    'SheetNames' in workbook &&
    'Sheets' in workbook &&
    Array.isArray((workbook as { SheetNames: unknown }).SheetNames) &&
    (workbook as { SheetNames: unknown[] }).SheetNames.length > 0
  );
};

/**
 * Parse Excel file using XLSX
 */
const parseExcel = (
  file: File,
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('No data read from file');
        }

        const workbook: unknown = XLSX.read(data, { type: 'array' });

        if (!isValidXLSXWorkbook(workbook)) {
          throw new Error('Excel file contains no valid sheets');
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          throw new Error('Could not access worksheet');
        }

        const jsonData: unknown = XLSX.utils.sheet_to_json(worksheet, {
          defval: null,
        });

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          throw new Error('Excel file is empty');
        }

        // Validate first row is an object
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const firstRow = jsonData[0];
        if (typeof firstRow !== 'object' || firstRow === null) {
          throw new Error('Invalid Excel data structure');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const columns = Object.keys(firstRow);
        resolve({
          rows: jsonData as Record<string, unknown>[],
          columns,
        });
      } catch (error) {
        reject(
          new Error(
            `Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ),
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Type guard to check if value is a valid JSON record array for data parsing
 */
const isValidJSONRecordArray = (
  value: unknown,
): value is Record<string, unknown>[] => {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'object' &&
    value[0] !== null &&
    !Array.isArray(value[0])
  );
};

/**
 * Parse JSON file
 */
const parseJSON = (
  file: File,
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('No data read from file');
        }

        const parsed: unknown = JSON.parse(text);

        // Handle different JSON structures
        let rows: Record<string, unknown>[];

        if (isValidJSONRecordArray(parsed)) {
          rows = parsed;
        } else if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'data' in parsed &&
          isValidJSONRecordArray((parsed as Record<string, unknown>).data)
        ) {
          rows = (parsed as { data: Record<string, unknown>[] }).data;
        } else {
          throw new Error(
            'JSON must be an array of objects or contain a data array of objects',
          );
        }

        if (rows.length === 0) {
          throw new Error('JSON file contains no data');
        }

        const columns = Object.keys(rows[0]);
        resolve({ rows, columns });
      } catch (error) {
        reject(
          new Error(
            `JSON parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ),
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read JSON file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Analyze columns and create metadata
 */
const analyzeColumns = (
  rows: Record<string, unknown>[],
  columnNames: string[],
): DataColumn[] => {
  return columnNames.map((name) => {
    const values = rows.map((row) => row[name]);
    const nonNullValues = values.filter((v) => v !== null && v !== undefined);
    const uniqueValues = new Set(nonNullValues);

    const nullCount = values.length - nonNullValues.length;
    const nullPercentage = (nullCount / values.length) * 100;

    return {
      name,
      originalName: name,
      type: detectColumnType(values),
      sampleValues: nonNullValues.slice(0, 5),
      uniqueCount: uniqueValues.size,
      nullCount,
      nullPercentage,
    };
  });
};

/**
 * Main parser function that handles all file types
 */
export const parseDataFile = async (file: File): Promise<ParsedDataset> => {
  const startTime = performance.now();

  // Determine file format
  const extension = file.name.split('.').pop()?.toLowerCase();
  let format: FileFormat;

  if (extension === 'csv') {
    format = 'csv';
  } else if (extension === 'xlsx' || extension === 'xls') {
    format = 'excel';
  } else if (extension === 'json') {
    format = 'json';
  } else {
    throw new Error(
      `Unsupported file format: ${extension}. Please upload CSV, Excel, or JSON files.`,
    );
  }

  // Parse based on format
  let parsedData: { rows: Record<string, unknown>[]; columns: string[] };

  try {
    switch (format) {
      case 'csv':
        parsedData = await parseCSV(file);
        break;
      case 'excel':
        parsedData = await parseExcel(file);
        break;
      case 'json':
        parsedData = await parseJSON(file);
        break;
      default:
        throw new Error('Invalid format');
    }

    // Validate structure
    DatasetSchema.parse(parsedData);

    // Analyze columns
    const columns = analyzeColumns(parsedData.rows, parsedData.columns);

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // Create dataset object
    const dataset: ParsedDataset = {
      id: `dataset_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      fileName: file.name,
      fileSize: file.size,
      format,
      rows: parsedData.rows,
      columns,
      rowCount: parsedData.rows.length,
      uploadedAt: new Date(),
      processingTime,
    };

    return dataset;
  } catch (error) {
    throw new Error(
      `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Validate file before parsing
 */
export const validateFile = (
  file: File,
  maxSizeBytes: number = 3 * 1024 * 1024 * 1024,
): { valid: boolean; error?: string } => {
  const allowedExtensions = ['csv', 'xlsx', 'xls', 'json'];
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type. Please upload ${allowedExtensions.join(', ')} files.`,
    };
  }

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${formatFileSize(maxSizeBytes)}.`,
    };
  }

  return { valid: true };
};
