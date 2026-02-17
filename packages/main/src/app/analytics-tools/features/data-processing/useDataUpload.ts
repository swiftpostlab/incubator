import { useState, useCallback } from 'react';
import type { ParsedDataset } from '../../types/analytics';
import { parseDataFile, validateFile } from './dataParser';

interface UploadState {
  dataset: ParsedDataset | null;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

interface UploadActions {
  uploadFile: (file: File) => Promise<void>;
  clearDataset: () => void;
  reset: () => void;
}

/**
 * Hook for managing data file uploads and parsing
 */
export const useDataUpload = (): UploadState & UploadActions => {
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    try {
      // Reset state
      setError(null);
      setIsUploading(true);
      setProgress(0);

      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Simulate progress for UX
      setProgress(10);

      // Parse file
      const parsedDataset = await parseDataFile(file);

      setProgress(90);

      // Store dataset
      setDataset(parsedDataset);
      setProgress(100);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to upload file';
      setError(errorMessage);
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const clearDataset = useCallback(() => {
    setDataset(null);
    setError(null);
    setProgress(0);
  }, []);

  const reset = useCallback(() => {
    setDataset(null);
    setError(null);
    setProgress(0);
    setIsUploading(false);
  }, []);

  return {
    dataset,
    isUploading,
    progress,
    error,
    uploadFile,
    clearDataset,
    reset,
  };
};
