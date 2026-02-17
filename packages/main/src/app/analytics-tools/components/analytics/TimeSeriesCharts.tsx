'use client';

import { memo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Paper from '@swiftpost/elysium/ui/base/Paper';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import { staticTheme } from '@/styles/staticTheme';
import type { TimeSeriesResult } from '../../types/analytics';

interface Props {
  result: TimeSeriesResult;
}

const TimeSeriesCharts: React.FC<Props> = ({ result }) => {
  return (
    <Stack spacing={staticTheme.spacing(4)}>
      {/* Main Trend Chart */}
      <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
        <Text variant="h6" gutterBottom>
          Time Series Trend Analysis
        </Text>
        <Text variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Historical data with trend line and moving average
        </Text>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={result.trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke={staticTheme.palette.primary.main}
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Actual Value"
            />
            {result.trends.some((t) => t.movingAverage !== undefined) && (
              <Line
                type="monotone"
                dataKey="movingAverage"
                stroke={staticTheme.palette.secondary.main}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Moving Average"
              />
            )}
            {result.trends.some((t) => t.trend !== undefined) && (
              <Line
                type="monotone"
                dataKey="trend"
                stroke={staticTheme.palette.success.main}
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                name="Trend Line"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Paper>

      {/* Seasonality Info */}
      {result.seasonality && (
        <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
          <Text variant="h6" gutterBottom>
            Seasonality Detection
          </Text>
          <Box
            sx={{
              padding: staticTheme.spacing(2),
              backgroundColor: 'info.light',
              borderRadius: staticTheme.spacing(1),
            }}
          >
            <Text variant="subtitle1" fontWeight="bold">
              Pattern Detected: {result.seasonality.pattern}
            </Text>
            <Text variant="body2" sx={{ mt: 1 }}>
              Strength: {(result.seasonality.strength * 100).toFixed(1)}%
            </Text>
            <Text
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: 'block' }}
            >
              The data shows a recurring{' '}
              {result.seasonality.pattern.toLowerCase()} pattern with{' '}
              {result.seasonality.strength > 0.7 ?
                'strong'
              : result.seasonality.strength > 0.4 ?
                'moderate'
              : 'weak'}{' '}
              correlation.
            </Text>
          </Box>
        </Paper>
      )}

      {/* Forecast */}
      {result.forecast && result.forecast.length > 0 && (
        <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
          <Text variant="h6" gutterBottom>
            Future Forecast
          </Text>
          <Text variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Linear forecast with 95% confidence interval
          </Text>

          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart
              data={[
                ...result.trends.slice(-30),
                ...result.forecast.map((f) => ({
                  ...f,
                  value: undefined,
                  isForecast: true,
                })),
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Legend />

              {/* Historical data */}
              <Line
                type="monotone"
                dataKey="value"
                stroke={staticTheme.palette.primary.main}
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Historical"
              />

              {/* Forecast */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke={staticTheme.palette.warning.main}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4 }}
                name="Forecast"
              />

              {/* Confidence interval */}
              <Area
                type="monotone"
                dataKey="upperBound"
                stroke="none"
                fill={staticTheme.palette.warning.light}
                fillOpacity={0.3}
                name="Upper Bound"
              />
              <Area
                type="monotone"
                dataKey="lowerBound"
                stroke="none"
                fill={staticTheme.palette.warning.light}
                fillOpacity={0.3}
                name="Lower Bound"
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Forecast Table */}
          <Box sx={{ mt: 3, overflowX: 'auto' }}>
            <Text variant="subtitle2" gutterBottom>
              Forecast Details
            </Text>
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
                  <Text component="th">Date</Text>
                  <Text component="th">Predicted Value</Text>
                  <Text component="th">Lower Bound</Text>
                  <Text component="th">Upper Bound</Text>
                </tr>
              </thead>
              <tbody>
                {result.forecast.slice(0, 10).map((forecast) => (
                  <tr key={forecast.date}>
                    <Text component="td">{forecast.date}</Text>
                    <Text component="td" fontWeight="medium">
                      {forecast.predicted.toFixed(2)}
                    </Text>
                    <Text component="td">{forecast.lowerBound.toFixed(2)}</Text>
                    <Text component="td">{forecast.upperBound.toFixed(2)}</Text>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Decomposition */}
      {result.decomposition && result.decomposition.length > 0 && (
        <Paper elevation={2} sx={{ padding: staticTheme.spacing(3) }}>
          <Text variant="h6" gutterBottom>
            Time Series Decomposition
          </Text>
          <Text variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Breaking down the time series into trend, seasonal, and residual
            components
          </Text>

          {/* Trend Component */}
          <Box sx={{ mb: 3 }}>
            <Text variant="subtitle2" gutterBottom>
              Trend Component
            </Text>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={result.decomposition}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 10 }}
                />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke={staticTheme.palette.primary.main}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Seasonal Component */}
          <Box sx={{ mb: 3 }}>
            <Text variant="subtitle2" gutterBottom>
              Seasonal Component
            </Text>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={result.decomposition}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 10 }}
                />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="seasonal"
                  stroke={staticTheme.palette.secondary.main}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Residual Component */}
          <Box>
            <Text variant="subtitle2" gutterBottom>
              Residual Component
            </Text>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={result.decomposition}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 10 }}
                />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="residual"
                  stroke={staticTheme.palette.error.main}
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}
    </Stack>
  );
};

export type TimeSeriesChartsProps = Props;
export default memo(TimeSeriesCharts);
