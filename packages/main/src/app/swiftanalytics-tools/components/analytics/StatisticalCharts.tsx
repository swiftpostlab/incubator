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
  ScatterChart,
  Scatter,
  Cell,
} from 'recharts';
import { staticTheme } from '@/styles/staticTheme';
import type { StatisticalAnalysisResult } from '../../types/analytics';

interface Props {
  result: StatisticalAnalysisResult;
}

const StatisticalCharts: React.FC<Props> = ({ result }) => {
  return (
    <Stack spacing={staticTheme.spacing(4)}>
      {/* Descriptive Statistics Table */}
      <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
        <Text variant="h6" gutterBottom>
          Descriptive Statistics
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
                <Text component="th">Mean</Text>
                <Text component="th">Median</Text>
                <Text component="th">Std Dev</Text>
                <Text component="th">Min</Text>
                <Text component="th">Max</Text>
                <Text component="th">Skewness</Text>
              </tr>
            </thead>
            <tbody>
              {result.descriptiveStats.map((stat) => (
                <tr key={stat.column}>
                  <Text component="td" fontWeight="medium">
                    {stat.column}
                  </Text>
                  <Text component="td">{stat.mean.toFixed(2)}</Text>
                  <Text component="td">{stat.median.toFixed(2)}</Text>
                  <Text component="td">{stat.stdDev.toFixed(2)}</Text>
                  <Text component="td">{stat.min.toFixed(2)}</Text>
                  <Text component="td">{stat.max.toFixed(2)}</Text>
                  <Text component="td">{stat.skewness.toFixed(2)}</Text>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      </Paper>

      {/* Distributions */}
      {result.distributions.map((dist) => (
        <Paper
          key={dist.column}
          elevation={2}
          sx={{ padding: staticTheme.spacing(3) }}
        >
          <Text variant="h6" gutterBottom>
            Distribution: {dist.column}
          </Text>
          <Text variant="body2" color="text.secondary" gutterBottom>
            {dist.isNormal ?
              '✓ Data appears normally distributed'
            : '✗ Data does not appear normally distributed'}
            {dist.normalityTest &&
              ` (p-value: ${dist.normalityTest.pValue.toFixed(4)})`}
          </Text>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dist.histogram}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="bin"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="count"
                fill={staticTheme.palette.primary.main}
                name="Frequency"
              />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      ))}

      {/* Correlation Matrix */}
      {result.correlations && result.correlations.length > 0 && (
        <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
          <Text variant="h6" gutterBottom>
            Correlation Analysis
          </Text>
          <Text variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pearson correlation coefficients between numeric variables (-1 to
            +1)
          </Text>

          <Box sx={{ overflowX: 'auto' }}>
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th, & td': {
                  padding: staticTheme.spacing(1.5),
                  textAlign: 'center',
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
                  <Text component="th">Variable 1</Text>
                  <Text component="th">Variable 2</Text>
                  <Text component="th">Pearson (r)</Text>
                  <Text component="th">Strength</Text>
                </tr>
              </thead>
              <tbody>
                {result.correlations.map((corr, idx) => {
                  const strength = Math.abs(corr.pearson);
                  let strengthLabel = 'Weak';
                  let color = 'text.secondary';

                  if (strength > 0.7) {
                    strengthLabel = 'Strong';
                    color = 'error.main';
                  } else if (strength > 0.4) {
                    strengthLabel = 'Moderate';
                    color = 'warning.main';
                  }

                  return (
                    <tr key={idx}>
                      <Text component="td">{corr.column1}</Text>
                      <Text component="td">{corr.column2}</Text>
                      <Text component="td" fontWeight="bold">
                        {corr.pearson.toFixed(3)}
                      </Text>
                      <Text component="td" sx={{ color }}>
                        {strengthLabel}
                      </Text>
                    </tr>
                  );
                })}
              </tbody>
            </Box>
          </Box>
        </Paper>
      )}
    </Stack>
  );
};

export type StatisticalChartsProps = Props;
export default memo(StatisticalCharts);
