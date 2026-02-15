'use client';

import { memo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

interface Props {
  title: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
  trend?: 'up' | 'down';
  subtitle?: string;
}

const StatCard: React.FC<Props> = ({
  title,
  value,
  icon,
  color = 'primary.main',
  trend,
  subtitle,
}) => {
  return (
    <Box
      sx={{
        bgcolor: 'white',
        borderRadius: 4,
        p: 3,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderLeft: '4px solid',
        borderLeftColor: color,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
      >
        <Box>
          <Text variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {title}
          </Text>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Text variant="h5" sx={{ fontWeight: 700, color }}>
              {value}
            </Text>
            {trend && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  color: trend === 'up' ? 'success.main' : 'error.main',
                }}
              >
                {trend === 'up' ?
                  <TrendingUpIcon sx={{ fontSize: 20 }} />
                : <TrendingDownIcon sx={{ fontSize: 20 }} />}
              </Box>
            )}
          </Stack>
          {subtitle && (
            <Text variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Text>
          )}
        </Box>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: `${color}15`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Box>
  );
};

export type StatCardProps = Props;
export default memo(StatCard);
