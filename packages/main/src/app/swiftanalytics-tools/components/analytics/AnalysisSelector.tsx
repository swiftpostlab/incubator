'use client';

import { memo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Paper from '@swiftpost/elysium/ui/base/Paper';
import Checkbox from '@swiftpost/elysium/ui/base/Checkbox';
import FormControlLabel from '@swiftpost/elysium/ui/base/FormControlLabel';
import BarChartIcon from '@mui/icons-material/BarChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useTheme } from '@swiftpost/elysium/ui/useTheme';
import { staticTheme } from '@/styles/staticTheme';
import type { AnalysisType } from '../../types/analytics';

interface AnalysisOption {
  type: AnalysisType;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiredColumns: string;
}

const analysisOptions: AnalysisOption[] = [
  {
    type: 'statistical',
    name: 'Statistical Analysis',
    description:
      'Descriptive statistics, correlations, distributions, and hypothesis tests',
    icon: <BarChartIcon sx={{ fontSize: 40 }} />,
    requiredColumns: 'Requires: Numeric columns',
  },
  {
    type: 'data-quality',
    name: 'Data Quality & Exploration',
    description:
      'Data profiling, missing values, outlier detection, and duplicate analysis',
    icon: <AssessmentIcon sx={{ fontSize: 40 }} />,
    requiredColumns: 'Works with: Any data type',
  },
  {
    type: 'business',
    name: 'Business & Marketing Analytics',
    description:
      'Sales performance, cohort analysis, RFM segmentation, and customer insights',
    icon: <BusinessIcon sx={{ fontSize: 40 }} />,
    requiredColumns: 'Requires: Date, revenue, customer ID columns',
  },
  {
    type: 'time-series',
    name: 'Time Series Analysis',
    description:
      'Trend detection, moving averages, seasonality, and forecasting',
    icon: <TrendingUpIcon sx={{ fontSize: 40 }} />,
    requiredColumns: 'Requires: Date and numeric value columns',
  },
];

interface Props {
  selectedAnalyses: Set<AnalysisType>;
  onToggleAnalysis: (type: AnalysisType) => void;
  disabled?: boolean;
}

const AnalysisSelector: React.FC<Props> = ({
  selectedAnalyses,
  onToggleAnalysis,
  disabled = false,
}) => {
  const theme = useTheme();

  return (
    <Box>
      <Text variant="h5" gutterBottom>
        Select Analyses to Run
      </Text>
      <Text variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose one or more analysis types. You can select multiple to get a
        comprehensive view of your data.
      </Text>

      <Stack spacing={staticTheme.spacing(2)}>
        {analysisOptions.map((option) => {
          const isSelected = selectedAnalyses.has(option.type);

          return (
            <Paper
              key={option.type}
              elevation={isSelected ? 4 : 1}
              sx={{
                padding: staticTheme.spacing(3),
                cursor: disabled ? 'not-allowed' : 'pointer',
                border:
                  isSelected ?
                    `2px solid ${theme.palette.primary.main}`
                  : '2px solid transparent',
                transition: 'all 0.3s ease',
                opacity: disabled ? 0.5 : 1,
                '&:hover':
                  disabled ?
                    {}
                  : {
                      elevation: 3,
                      transform: 'translateY(-2px)',
                    },
              }}
              onClick={() => !disabled && onToggleAnalysis(option.type)}
            >
              <Stack direction="row" spacing={staticTheme.spacing(3)}>
                <Box
                  sx={{
                    color: isSelected ? 'primary.main' : 'text.secondary',
                    display: 'flex',
                    alignItems: 'flex-start',
                    paddingTop: staticTheme.spacing(0.5),
                  }}
                >
                  {option.icon}
                </Box>

                <Box flex={1}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                  >
                    <Text
                      variant="h6"
                      color={isSelected ? 'primary' : 'text.primary'}
                    >
                      {option.name}
                    </Text>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isSelected}
                          disabled={disabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            onToggleAnalysis(option.type);
                          }}
                        />
                      }
                      label=""
                      sx={{ margin: 0 }}
                    />
                  </Stack>

                  <Text variant="body2" color="text.secondary" gutterBottom>
                    {option.description}
                  </Text>

                  <Text
                    variant="caption"
                    sx={{
                      color: 'text.disabled',
                      fontStyle: 'italic',
                      display: 'block',
                      mt: 1,
                    }}
                  >
                    {option.requiredColumns}
                  </Text>
                </Box>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

export type AnalysisSelectorProps = Props;
export default memo(AnalysisSelector);
