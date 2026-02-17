'use client';

import { useCallback, useState } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Button from '@swiftpost/elysium/ui/base/Button';
import LinearProgress from '@swiftpost/elysium/ui/base/LinearProgress';
import Paper from '@swiftpost/elysium/ui/base/Paper';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import { staticTheme } from '@/styles/staticTheme';
import type { ParsedDataset } from '../../types/analytics';

interface Props {
  dataset: ParsedDataset | null;
  isUploading: boolean;
  progress: number;
  error: string | null;
  onFileUpload: (file: File) => void;
  onClear: () => void;
}

const DataUploadCard: React.FC<Props> = ({
  dataset,
  isUploading,
  progress,
  error,
  onFileUpload,
  onClear,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFileUpload(files[0]);
      }
    },
    [onFileUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileUpload(files[0]);
      }
    },
    [onFileUpload],
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <Paper
      elevation={3}
      sx={{
        padding: staticTheme.spacing(4),
        width: '100%',
      }}
    >
      {!dataset && !isUploading && (
        <Box
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          sx={{
            border: `2px dashed ${isDragging ? 'primary.main' : 'grey.400'}`,
            borderRadius: staticTheme.spacing(1),
            padding: staticTheme.spacing(6),
            textAlign: 'center',
            backgroundColor: isDragging ? 'action.hover' : 'background.paper',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
          }}
        >
          <Stack spacing={staticTheme.spacing(3)} alignItems="center">
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main' }} />
            <Text variant="h5" color="text.primary">
              {isDragging ?
                'Drop your file here'
              : 'Drag & drop your data file'}
            </Text>
            <Text variant="body2" color="text.secondary">
              or
            </Text>
            <Button variant="contained" component="label">
              Choose File
              <input
                type="file"
                hidden
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileSelect}
              />
            </Button>
            <Text variant="caption" color="text.secondary">
              Supported formats: CSV, Excel (.xlsx, .xls), JSON (up to 3GB)
            </Text>
          </Stack>
        </Box>
      )}

      {isUploading && (
        <Stack spacing={staticTheme.spacing(2)} alignItems="center">
          <Text variant="h6">Uploading and processing...</Text>
          <Box sx={{ width: '100%' }}>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
          <Text variant="body2" color="text.secondary">
            {progress}% complete
          </Text>
        </Stack>
      )}

      {error && (
        <Stack spacing={staticTheme.spacing(2)} alignItems="center">
          <ErrorIcon sx={{ fontSize: 48, color: 'error.main' }} />
          <Text variant="h6" color="error">
            Upload Failed
          </Text>
          <Text variant="body2" color="text.secondary" textAlign="center">
            {error}
          </Text>
          <Button variant="outlined" onClick={onClear}>
            Try Again
          </Button>
        </Stack>
      )}

      {dataset && !isUploading && (
        <Stack spacing={staticTheme.spacing(2)}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <CheckCircleIcon sx={{ color: 'success.main', fontSize: 32 }} />
            <Box flex={1}>
              <Text variant="h6">{dataset.fileName}</Text>
              <Text variant="body2" color="text.secondary">
                {formatFileSize(dataset.fileSize)} • {dataset.rowCount} rows •{' '}
                {dataset.columns.length} columns
              </Text>
            </Box>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={onClear}
            >
              Remove
            </Button>
          </Stack>

          <Box
            sx={{
              backgroundColor: 'grey.100',
              padding: staticTheme.spacing(2),
              borderRadius: staticTheme.spacing(1),
            }}
          >
            <Text variant="subtitle2" gutterBottom>
              Columns Preview:
            </Text>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {dataset.columns.slice(0, 10).map((col) => (
                <Box
                  key={col.name}
                  sx={{
                    backgroundColor: 'background.paper',
                    padding: `${staticTheme.spacing(0.5)} ${staticTheme.spacing(1)}`,
                    borderRadius: staticTheme.spacing(0.5),
                    border: '1px solid',
                    borderColor: 'grey.300',
                  }}
                >
                  <Text variant="caption">
                    {col.name} ({col.type})
                  </Text>
                </Box>
              ))}
              {dataset.columns.length > 10 && (
                <Text variant="caption" color="text.secondary">
                  +{dataset.columns.length - 10} more
                </Text>
              )}
            </Stack>
          </Box>
        </Stack>
      )}
    </Paper>
  );
};

export type DataUploadCardProps = Props;
export default DataUploadCard;
