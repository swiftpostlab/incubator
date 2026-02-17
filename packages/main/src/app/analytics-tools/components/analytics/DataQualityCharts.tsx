'use client';

import { memo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Paper from '@swiftpost/elysium/ui/base/Paper';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { staticTheme } from '@/styles/staticTheme';
import { useTheme } from '@swiftpost/elysium/ui/useTheme';
import type { DataQualityResult } from '../../types/analytics';

interface Props {
  result: DataQualityResult;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const DataQualityCharts: React.FC<Props> = ({ result }) => {
  const theme = useTheme();

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.error.main,
    theme.palette.warning.main,
    theme.palette.success.main,
  ];
  // Prepare data for missing values chart
  const missingValuesData = result.columnProfiles.map((profile) => ({
    column: profile.column,
    missingPercentage: profile.missingPercentage,
    completePercentage: 100 - profile.missingPercentage,
  }));

  // Prepare data for completeness pie
  const completenessData = [
    { name: 'Complete', value: result.overview.completeness },
    { name: 'Missing', value: 100 - result.overview.completeness },
  ];

  return (
    <Stack spacing={staticTheme.spacing(4)}>
      {/* Overview Cards */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={staticTheme.spacing(2)}
      >
        <Paper
          elevation={2}
          sx={{
            padding: staticTheme.spacing(3),
            flex: 1,
            textAlign: 'center',
          }}
        >
          <Text variant="h3" color="primary">
            {result.overview.totalRows.toLocaleString()}
          </Text>
          <Text variant="body2" color="text.secondary">
            Total Rows
          </Text>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            padding: staticTheme.spacing(3),
            flex: 1,
            textAlign: 'center',
          }}
        >
          <Text variant="h3" color="primary">
            {result.overview.totalColumns}
          </Text>
          <Text variant="body2" color="text.secondary">
            Total Columns
          </Text>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            padding: staticTheme.spacing(3),
            flex: 1,
            textAlign: 'center',
          }}
        >
          <Text variant="h3" color="primary">
            {result.overview.completeness.toFixed(1)}%
          </Text>
          <Text variant="body2" color="text.secondary">
            Data Completeness
          </Text>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            padding: staticTheme.spacing(3),
            flex: 1,
            textAlign: 'center',
          }}
        >
          <Text variant="h3" color="primary">
            {formatBytes(result.overview.memoryUsage)}
          </Text>
          <Text variant="body2" color="text.secondary">
            Dataset Size
          </Text>
        </Paper>
      </Stack>

      {/* Completeness Pie Chart */}
      <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
        <Text variant="h6" gutterBottom>
          Overall Data Completeness
        </Text>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={completenessData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry.name}: ${entry.value.toFixed(1)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {completenessData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === 0 ? COLORS[4] : COLORS[2]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Paper>

      {/* Missing Values by Column */}
      <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
        <Text variant="h6" gutterBottom>
          Missing Values by Column
        </Text>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={missingValuesData}
            layout="vertical"
            margin={{ left: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} unit="%" />
            <YAxis dataKey="column" type="category" width={100} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="completePercentage"
              stackId="a"
              fill={COLORS[4]}
              name="Complete"
            />
            <Bar
              dataKey="missingPercentage"
              stackId="a"
              fill={COLORS[2]}
              name="Missing"
            />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* Column Profiles */}
      <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
        <Text variant="h6" gutterBottom>
          Column Profiles
        </Text>
        <Box sx={{ overflowX: 'auto' }}>
          <Box
            component="table"
            sx={{
              width: '100%',
              borderCollapse: 'collapse',
              '& th, & td': {
                padding: staticTheme.spacing(1.5),
                textAlign: 'left',
                borderBottom: '1px solid',
                borderColor: 'divider',
              },
              '& th': {
                backgroundColor: 'grey.100',
                fontWeight: 'bold',
              },
            }}
          >
            <thead>
              <tr>
                <Text component="th">Column</Text>
                <Text component="th">Type</Text>
                <Text component="th">Unique Values</Text>
                <Text component="th">Missing (%)</Text>
                <Text component="th">Uniqueness (%)</Text>
              </tr>
            </thead>
            <tbody>
              {result.columnProfiles.map((profile) => (
                <tr key={profile.column}>
                  <Text component="td" fontWeight="medium">
                    {profile.column}
                  </Text>
                  <Text component="td">{profile.type}</Text>
                  <Text component="td">
                    {profile.uniqueValues.toLocaleString()}
                  </Text>
                  <Text
                    component="td"
                    sx={{
                      color:
                        profile.missingPercentage > 20 ? 'error.main'
                        : profile.missingPercentage > 5 ? 'warning.main'
                        : 'success.main',
                    }}
                  >
                    {profile.missingPercentage.toFixed(1)}%
                  </Text>
                  <Text component="td">
                    {profile.uniquePercentage.toFixed(1)}%
                  </Text>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      </Paper>

      {/* Outliers Summary */}
      {result.outliers.length > 0 && (
        <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
          <Text variant="h6" gutterBottom>
            Outliers Detected
          </Text>
          <Stack spacing={staticTheme.spacing(2)}>
            {result.outliers.map((outlier, idx) => (
              <Box
                key={idx}
                sx={{
                  padding: staticTheme.spacing(2),
                  backgroundColor: 'grey.50',
                  borderRadius: staticTheme.spacing(1),
                }}
              >
                <Text variant="subtitle2">
                  {outlier.column} ({outlier.method.toUpperCase()})
                </Text>
                <Text variant="body2" color="text.secondary">
                  {outlier.outlierCount} outliers detected (
                  {outlier.outlierPercentage.toFixed(1)}% of values)
                </Text>
                {outlier.outlierValues.length > 0 && (
                  <Text variant="caption" color="text.secondary">
                    Sample outliers:{' '}
                    {outlier.outlierValues
                      .slice(0, 5)
                      .map((v) => v.value.toFixed(2))
                      .join(', ')}
                  </Text>
                )}
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Duplicates */}
      <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
        <Text variant="h6" gutterBottom>
          Duplicate Rows
        </Text>
        <Box
          sx={{
            padding: staticTheme.spacing(2),
            backgroundColor:
              result.duplicates.duplicateRowCount > 0 ?
                'warning.light'
              : 'success.light',
            borderRadius: staticTheme.spacing(1),
          }}
        >
          <Text variant="h4">
            {result.duplicates.duplicateRowCount.toLocaleString()}
          </Text>
          <Text variant="body2">
            duplicate rows found (
            {result.duplicates.duplicatePercentage.toFixed(2)}% of total)
          </Text>
        </Box>
      </Paper>
    </Stack>
  );
};

export type DataQualityChartsProps = Props;
export default memo(DataQualityCharts);
