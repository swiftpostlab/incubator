'use client';

import { useState, useCallback } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Button from '@swiftpost/elysium/ui/base/Button';
import Stepper from '@swiftpost/elysium/ui/base/Stepper';
import Step from '@swiftpost/elysium/ui/base/Step';
import StepLabel from '@swiftpost/elysium/ui/base/StepLabel';
import CircularProgress from '@swiftpost/elysium/ui/base/CircularProgress';
import Divider from '@swiftpost/elysium/ui/base/Divider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { staticTheme } from '@/styles/staticTheme';
import { useDataUpload } from './features/data-processing/useDataUpload';
import DataUploadCard from './components/analytics/DataUploadCard';
import AnalysisSelector from './components/analytics/AnalysisSelector';
import StatisticalCharts from './components/analytics/StatisticalCharts';
import DataQualityCharts from './components/analytics/DataQualityCharts';
import BusinessAnalyticsCharts from './components/analytics/BusinessAnalyticsCharts';
import TimeSeriesCharts from './components/analytics/TimeSeriesCharts';
import { performStatisticalAnalysis } from './features/statistical-analysis/statisticalAnalysis';
import { performDataQualityAnalysis } from './features/data-quality/dataQualityAnalysis';
import { performBusinessAnalytics } from './features/business-analytics/businessAnalytics';
import { performTimeSeriesAnalysis } from './features/time-series/timeSeriesAnalysis';
import type {
  AnalysisType,
  AnalysisResult,
  StatisticalAnalysisResult,
  DataQualityResult,
  BusinessAnalyticsResult,
  TimeSeriesResult,
} from './types/analytics';

const steps = ['Upload Data', 'Select Analyses', 'View Results'];

const AnalyticsPage: React.FC = () => {
  const { dataset, isUploading, progress, error, uploadFile, clearDataset } =
    useDataUpload();

  const [activeStep, setActiveStep] = useState(0);
  const [selectedAnalyses, setSelectedAnalyses] = useState<Set<AnalysisType>>(
    new Set(),
  );
  const [analysisResults, setAnalysisResults] = useState<
    Map<AnalysisType, AnalysisResult>
  >(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisErrors, setAnalysisErrors] = useState<
    Map<AnalysisType, string>
  >(new Map());

  const handleFileUpload = useCallback(
    (file: File) => {
      uploadFile(file);
      setActiveStep(1);
      setSelectedAnalyses(new Set());
      setAnalysisResults(new Map());
      setAnalysisErrors(new Map());
    },
    [uploadFile],
  );

  const handleToggleAnalysis = useCallback((type: AnalysisType) => {
    setSelectedAnalyses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  }, []);

  const handleRunAnalyses = useCallback(async () => {
    if (!dataset || selectedAnalyses.size === 0) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResults(new Map());
    setAnalysisErrors(new Map());

    const results = new Map<AnalysisType, AnalysisResult>();
    const errors = new Map<AnalysisType, string>();

    for (const analysisType of selectedAnalyses) {
      try {
        let result: AnalysisResult;

        switch (analysisType) {
          case 'statistical':
            {
              const data = performStatisticalAnalysis(dataset);
              result = { type: 'statistical', data };
            }
            break;

          case 'data-quality':
            {
              const data = performDataQualityAnalysis(dataset);
              result = { type: 'data-quality', data };
            }
            break;

          case 'business':
            {
              const data = performBusinessAnalytics(dataset);
              result = { type: 'business', data };
            }
            break;

          case 'time-series':
            {
              const data = performTimeSeriesAnalysis(dataset);
              result = { type: 'time-series', data };
            }
            break;

          default:
            throw new Error(`Unknown analysis type: ${analysisType}`);
        }

        results.set(analysisType, result);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        errors.set(analysisType, errorMessage);
        console.error(`Error running ${analysisType} analysis:`, err);
      }
    }

    setAnalysisResults(results);
    setAnalysisErrors(errors);
    setIsAnalyzing(false);
    setActiveStep(2);
  }, [dataset, selectedAnalyses]);

  const handleReset = useCallback(() => {
    clearDataset();
    setActiveStep(0);
    setSelectedAnalyses(new Set());
    setAnalysisResults(new Map());
    setAnalysisErrors(new Map());
  }, [clearDataset]);

  const handleBackToSelection = useCallback(() => {
    setActiveStep(1);
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'grey.50',
        padding: staticTheme.spacing(4),
      }}
    >
      <Stack spacing={staticTheme.spacing(4)} maxWidth="1400px" margin="0 auto">
        {/* Header */}
        <Box sx={{ textAlign: 'center' }}>
          <Text variant="h3" gutterBottom>
            SwiftAnalytics
          </Text>
          <Text variant="h6" color="text.secondary">
            Comprehensive Data Analysis Platform
          </Text>
        </Box>

        {/* Stepper */}
        <Box sx={{ width: '100%' }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Divider />

        {/* Step 1: Upload Data */}
        {activeStep === 0 && (
          <DataUploadCard
            dataset={dataset}
            isUploading={isUploading}
            progress={progress}
            error={error}
            onFileUpload={handleFileUpload}
            onClear={handleReset}
          />
        )}

        {/* Step 2: Select Analyses */}
        {activeStep === 1 && dataset && (
          <Stack spacing={staticTheme.spacing(3)}>
            <AnalysisSelector
              selectedAnalyses={selectedAnalyses}
              onToggleAnalysis={handleToggleAnalysis}
              disabled={isAnalyzing}
            />

            <Stack direction="row" spacing={2} justifyContent="center">
              <Button variant="outlined" onClick={handleReset}>
                Upload Different File
              </Button>
              <Button
                variant="contained"
                size="large"
                disabled={selectedAnalyses.size === 0 || isAnalyzing}
                startIcon={
                  isAnalyzing ?
                    <CircularProgress size={20} />
                  : <PlayArrowIcon />
                }
                onClick={handleRunAnalyses}
              >
                {isAnalyzing ? 'Running Analyses...' : 'Run Analyses'}
              </Button>
            </Stack>
          </Stack>
        )}

        {/* Step 3: View Results */}
        {activeStep === 2 && (
          <Stack spacing={staticTheme.spacing(4)}>
            <Box sx={{ textAlign: 'center' }}>
              <Text variant="h5" gutterBottom>
                Analysis Results
              </Text>
              <Text variant="body2" color="text.secondary">
                {dataset?.fileName} • {selectedAnalyses.size} analyses completed
              </Text>
            </Box>

            {/* Display Results */}
            {Array.from(analysisResults.entries()).map(([type, result]) => (
              <Box key={type}>
                <Text
                  variant="h4"
                  gutterBottom
                  sx={{ textTransform: 'capitalize' }}
                >
                  {type.replace('-', ' ')} Results
                </Text>

                {result.type === 'statistical' && (
                  <StatisticalCharts result={result.data} />
                )}

                {result.type === 'data-quality' && (
                  <DataQualityCharts result={result.data} />
                )}

                {result.type === 'business' && (
                  <BusinessAnalyticsCharts result={result.data} />
                )}

                {result.type === 'time-series' && (
                  <TimeSeriesCharts result={result.data} />
                )}
              </Box>
            ))}

            {/* Display Errors */}
            {Array.from(analysisErrors.entries()).map(([type, errorMsg]) => (
              <Box
                key={type}
                sx={{
                  padding: staticTheme.spacing(3),
                  backgroundColor: 'error.light',
                  borderRadius: staticTheme.spacing(1),
                }}
              >
                <Text variant="h6" color="error.dark">
                  {type.replace('-', ' ')} Analysis Failed
                </Text>
                <Text variant="body2" sx={{ mt: 1 }}>
                  {errorMsg}
                </Text>
              </Box>
            ))}

            {/* Action Buttons */}
            <Stack
              direction="row"
              spacing={2}
              justifyContent="center"
              sx={{ mt: 4 }}
            >
              <Button variant="outlined" onClick={handleBackToSelection}>
                Run More Analyses
              </Button>
              <Button
                variant="contained"
                startIcon={<RestartAltIcon />}
                onClick={handleReset}
              >
                Start Over
              </Button>
            </Stack>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default AnalyticsPage;
