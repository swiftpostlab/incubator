'use client';

import { memo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Paper from '@swiftpost/elysium/ui/base/Paper';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { staticTheme } from '@/styles/staticTheme';
import type { BusinessAnalyticsResult } from '../../types/analytics';

interface Props {
  result: BusinessAnalyticsResult;
}

const BusinessAnalyticsCharts: React.FC<Props> = ({ result }) => {
  return (
    <Stack spacing={staticTheme.spacing(4)}>
      {/* Sales Performance */}
      {result.salesPerformance && result.salesPerformance.length > 0 && (
        <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
          <Text variant="h6" gutterBottom>
            Sales Performance Over Time
          </Text>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={result.salesPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value: number) =>
                  typeof value === 'number' ? value.toFixed(2) : value
                }
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke={staticTheme.palette.primary.main}
                strokeWidth={2}
                name="Revenue"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="transactions"
                stroke={staticTheme.palette.secondary.main}
                strokeWidth={2}
                name="Transactions"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Average Order Value */}
          <Box sx={{ mt: 3 }}>
            <Text variant="subtitle2" gutterBottom>
              Average Order Value Trend
            </Text>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={result.salesPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                />
                <Area
                  type="monotone"
                  dataKey="avgOrderValue"
                  stroke={staticTheme.palette.success.main}
                  fill={staticTheme.palette.success.light}
                  name="Avg Order Value"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}

      {/* RFM Analysis */}
      {result.rfmAnalysis && result.rfmAnalysis.length > 0 && (
        <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
          <Text variant="h6" gutterBottom>
            RFM Customer Segmentation
          </Text>
          <Text variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Customers segmented by Recency, Frequency, and Monetary value
          </Text>

          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={result.rfmAnalysis}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="segment"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="customers"
                fill={staticTheme.palette.primary.main}
                name="Number of Customers"
              />
            </BarChart>
          </ResponsiveContainer>

          {/* RFM Segment Details */}
          <Box sx={{ mt: 3, overflowX: 'auto' }}>
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
                  <Text component="th">Segment</Text>
                  <Text component="th">Customers</Text>
                  <Text component="th">Avg Recency (days)</Text>
                  <Text component="th">Avg Frequency</Text>
                  <Text component="th">Avg Monetary</Text>
                </tr>
              </thead>
              <tbody>
                {result.rfmAnalysis.map((segment) => (
                  <tr key={segment.segment}>
                    <Text component="td" fontWeight="medium">
                      {segment.segment}
                    </Text>
                    <Text component="td">{segment.customers}</Text>
                    <Text component="td">{segment.avgRecency.toFixed(0)}</Text>
                    <Text component="td">
                      {segment.avgFrequency.toFixed(1)}
                    </Text>
                    <Text component="td">
                      ${segment.avgMonetary.toFixed(2)}
                    </Text>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Cohort Analysis */}
      {result.cohortAnalysis && result.cohortAnalysis.length > 0 && (
        <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
          <Text variant="h6" gutterBottom>
            Cohort Retention Analysis
          </Text>
          <Text variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Customer retention rates by cohort over time
          </Text>

          {result.cohortAnalysis.slice(0, 5).map((cohort) => (
            <Box key={cohort.cohortDate} sx={{ mb: 3 }}>
              <Text variant="subtitle2" gutterBottom>
                Cohort: {cohort.cohortDate} ({cohort.cohortSize} customers)
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={cohort.retentionRates}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    label={{
                      value: 'Months',
                      position: 'insideBottom',
                      offset: -5,
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    label={{
                      value: 'Retention %',
                      angle: -90,
                      position: 'insideLeft',
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke={staticTheme.palette.primary.main}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Retention Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          ))}
        </Paper>
      )}

      {/* No Data Message */}
      {!result.salesPerformance &&
        !result.rfmAnalysis &&
        !result.cohortAnalysis && (
          <Paper
            elevation={2}
            sx={{ padding: staticTheme.spacing(4), textAlign: 'center' }}
          >
            <Text variant="h6" color="text.secondary">
              No business analytics data available
            </Text>
            <Text variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Make sure your dataset contains date, revenue, and customer ID
              columns.
            </Text>
          </Paper>
        )}
    </Stack>
  );
};

export type BusinessAnalyticsChartsProps = Props;
export default memo(BusinessAnalyticsCharts);
