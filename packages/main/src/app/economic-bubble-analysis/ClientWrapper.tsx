'use client';

import { useState, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import StorageIcon from '@mui/icons-material/Storage';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import LayersIcon from '@mui/icons-material/Layers';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CalculateIcon from '@mui/icons-material/Calculate';
import HistoryIcon from '@mui/icons-material/History';
import BoltIcon from '@mui/icons-material/Bolt';
import type { SvgIconComponent } from '@mui/icons-material';

// ============ TYPE DEFINITIONS ============

interface Quarter {
  period: string;
  revenue: number;
  fcf: number;
  capex: number;
  debt: number;
  ebitda: number;
  marketCap: number;
  evSales: number;
  pe: number | null;
}

interface Company {
  id: number;
  ticker: string;
  name: string;
  segment: SegmentKey;
  quarters: Quarter[];
}

interface Flags {
  F1: boolean;
  F2: boolean;
  F3: boolean;
  F4: boolean;
  F5: boolean;
  F6: boolean;
}

interface RiskLevel {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  color: string;
  bg: string;
}

interface StressScenario {
  id: number;
  name: string;
  revenueGrowth: number;
  marginChange: number;
  capexRatio: number;
  discountRate: number;
}

interface HistoricalScenario {
  name: string;
  description: string;
  companies: string[];
  outcome: string;
  expectedFlags: Record<string, number>;
}

interface Tab {
  id: TabId;
  label: string;
  Icon: SvgIconComponent;
}

interface MetricCard {
  label: string;
  value: number | string;
  Icon: SvgIconComponent;
  color: string;
}

interface Principle {
  title: string;
  desc: string;
}

interface Segment {
  id: SegmentKey;
  label: string;
  examples: string;
}

interface FlagDefinition {
  id: keyof Flags;
  name: string;
  condition: string;
  description: string;
}

interface StressParam {
  key: keyof Pick<
    StressScenario,
    'revenueGrowth' | 'marginChange' | 'capexRatio' | 'discountRate'
  >;
  label: string;
  min: number;
  max: number;
}

interface FourOIndicator {
  name: string;
  status: string;
  color: string;
}

type TabId =
  | 'overview'
  | 'universe'
  | 'metrics'
  | 'stress'
  | 'dashboard'
  | 'historical';
type SegmentKey = 'infrastructure' | 'hyperscaler' | 'story-stock';
type Hypotheses = Record<SegmentKey, string>;

// ============ CONSTANTS ============

const INITIAL_COMPANIES: Company[] = [
  {
    id: 1,
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    segment: 'infrastructure',
    quarters: [
      {
        period: '2024-Q1',
        revenue: 26000,
        fcf: 10000,
        capex: 5000,
        debt: 9700,
        ebitda: 15000,
        marketCap: 520000,
        evSales: 20,
        pe: 55,
      },
      {
        period: '2024-Q2',
        revenue: 30000,
        fcf: 12000,
        capex: 6500,
        debt: 10200,
        ebitda: 18000,
        marketCap: 680000,
        evSales: 22,
        pe: 58,
      },
      {
        period: '2024-Q3',
        revenue: 35000,
        fcf: 14000,
        capex: 8000,
        debt: 11000,
        ebitda: 21000,
        marketCap: 850000,
        evSales: 24,
        pe: 62,
      },
      {
        period: '2024-Q4',
        revenue: 40000,
        fcf: 12000,
        capex: 14000,
        debt: 12500,
        ebitda: 24000,
        marketCap: 960000,
        evSales: 24,
        pe: 65,
      },
    ],
  },
  {
    id: 2,
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    segment: 'hyperscaler',
    quarters: [
      {
        period: '2024-Q1',
        revenue: 62000,
        fcf: 21000,
        capex: 11000,
        debt: 47000,
        ebitda: 30000,
        marketCap: 3100000,
        evSales: 12,
        pe: 36,
      },
      {
        period: '2024-Q2',
        revenue: 64000,
        fcf: 22000,
        capex: 13000,
        debt: 48000,
        ebitda: 31000,
        marketCap: 3200000,
        evSales: 12,
        pe: 37,
      },
      {
        period: '2024-Q3',
        revenue: 66000,
        fcf: 20000,
        capex: 15000,
        debt: 50000,
        ebitda: 32000,
        marketCap: 3300000,
        evSales: 12,
        pe: 38,
      },
      {
        period: '2024-Q4',
        revenue: 68000,
        fcf: 18000,
        capex: 18000,
        debt: 52000,
        ebitda: 33000,
        marketCap: 3400000,
        evSales: 12,
        pe: 39,
      },
    ],
  },
  {
    id: 3,
    ticker: 'AI',
    name: 'C3.ai Inc',
    segment: 'story-stock',
    quarters: [
      {
        period: '2024-Q1',
        revenue: 72,
        fcf: -40,
        capex: 12,
        debt: 0,
        ebitda: -35,
        marketCap: 3200,
        evSales: 11,
        pe: null,
      },
      {
        period: '2024-Q2',
        revenue: 78,
        fcf: -38,
        capex: 13,
        debt: 0,
        ebitda: -32,
        marketCap: 3500,
        evSales: 11,
        pe: null,
      },
      {
        period: '2024-Q3',
        revenue: 82,
        fcf: -42,
        capex: 14,
        debt: 0,
        ebitda: -38,
        marketCap: 3100,
        evSales: 9,
        pe: null,
      },
      {
        period: '2024-Q4',
        revenue: 87,
        fcf: -45,
        capex: 15,
        debt: 0,
        ebitda: -40,
        marketCap: 3000,
        evSales: 9,
        pe: null,
      },
    ],
  },
];

const INITIAL_HYPOTHESES: Hypotheses = {
  infrastructure:
    "These companies might be in a bubble if AI-related capex keeps exploding faster than revenue, margins compress (energy/hardware costs), and current valuations assume growth that does not show up in free cash flow. I'm wrong if AI-driven revenue growth translates into sustainably rising FCF and capex clearly pays for itself.",
  hyperscaler:
    'Hyperscalers could be overvalued if AI capex crowds out returns on core business, or if AI revenue fails to materialize proportionally to investment. The bubble thesis fails if AI integration drives margin expansion and defensible moats.',
  'story-stock':
    'Pure-play AI story stocks are bubble candidates if they show persistent negative FCF, rely on narrative over fundamentals, and trade at extreme multiples with no path to profitability.',
};

const INITIAL_STRESS_SCENARIOS: StressScenario[] = [
  {
    id: 1,
    name: 'Baseline',
    revenueGrowth: 20,
    marginChange: 0,
    capexRatio: 30,
    discountRate: 10,
  },
  {
    id: 2,
    name: 'Slower AI Adoption',
    revenueGrowth: 10,
    marginChange: -5,
    capexRatio: 30,
    discountRate: 10,
  },
  {
    id: 3,
    name: 'Higher Rates + Competition',
    revenueGrowth: 15,
    marginChange: -3,
    capexRatio: 35,
    discountRate: 13,
  },
];

const HISTORICAL_SCENARIOS: HistoricalScenario[] = [
  {
    name: 'Dot-Com Bubble (1999-2000)',
    description:
      'Test against internet infrastructure and e-commerce companies',
    companies: ['Pets.com', 'Webvan', 'Amazon', 'Cisco', 'Global Crossing'],
    outcome: 'Nasdaq fell 78%; 50%+ bankruptcies',
    expectedFlags: {
      'Pets.com': 5,
      Webvan: 5,
      Amazon: 3,
      Cisco: 3,
      'Global Crossing': 4,
    },
  },
  {
    name: 'Telecom Bubble (1999-2001)',
    description: 'Fiber optic infrastructure overbuild',
    companies: ['WorldCom', 'Qwest', 'Level 3', 'JDS Uniphase', 'Nokia'],
    outcome: 'Telecom index -89%; WorldCom bankrupt',
    expectedFlags: {
      WorldCom: 5,
      Qwest: 4,
      'Level 3': 4,
      'JDS Uniphase': 4,
      Nokia: 2,
    },
  },
  {
    name: 'Nifty Fifty (1968-1973)',
    description: 'Blue-chip growth stocks at extreme valuations',
    companies: ['Xerox', 'Polaroid', 'Avon', 'IBM', 'Coca-Cola'],
    outcome: '60-70% decline in 1973-74 bear market',
    expectedFlags: { Xerox: 4, Polaroid: 4, Avon: 4, IBM: 2, 'Coca-Cola': 1 },
  },
  {
    name: 'Housing/MBS (2005-2007)',
    description: "Burry's actual thesis - subprime mortgage securities",
    companies: [
      'New Century',
      'NovaStar',
      'Lehman',
      'Bear Stearns',
      'Wells Fargo',
    ],
    outcome: 'MBS/CDO collapse; multiple bankruptcies',
    expectedFlags: {
      'New Century': 5,
      NovaStar: 5,
      Lehman: 4,
      'Bear Stearns': 4,
      'Wells Fargo': 1,
    },
  },
];

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', Icon: ShowChartIcon },
  { id: 'universe', label: 'Universe & Hypothesis', Icon: GpsFixedIcon },
  { id: 'metrics', label: 'Metrics & Flags', Icon: StorageIcon },
  { id: 'stress', label: 'Stress Tests', Icon: BoltIcon },
  { id: 'dashboard', label: 'Risk Dashboard', Icon: WarningAmberIcon },
  { id: 'historical', label: 'Historical Tests', Icon: HistoryIcon },
];

const PRINCIPLES: Principle[] = [
  {
    title: 'Micro Over Macro',
    desc: 'Start with granular loan/company-level data, not narratives',
  },
  {
    title: 'Simple Stress Tests',
    desc: '"What if X goes wrong?" beats complex models',
  },
  {
    title: 'Price vs Fundamentals',
    desc: 'Every bubble involves disconnection from underlying value',
  },
  {
    title: 'Track Leading Indicators',
    desc: 'Early cracks appear before the collapse',
  },
  {
    title: 'Ignore Consensus',
    desc: 'Bubbles require widespread belief; skepticism is contrarian',
  },
  {
    title: 'Pre-commit to Actions',
    desc: 'Emotional discipline matters more than analytical precision',
  },
];

const SEGMENTS: Segment[] = [
  {
    id: 'infrastructure',
    label: 'AI Infrastructure',
    examples: 'NVDA, SMCI, AMD, EQIX',
  },
  {
    id: 'hyperscaler',
    label: 'Hyperscalers',
    examples: 'MSFT, GOOGL, AMZN, META',
  },
  {
    id: 'story-stock',
    label: 'AI Story Stocks',
    examples: 'AI, SOUN, PLTR, PATH',
  },
];

const FLAG_DEFINITIONS: FlagDefinition[] = [
  {
    id: 'F1',
    name: 'Capex > FCF',
    condition: 'capex/FCF > 1',
    description:
      'Investment exceeds cash generation—unsustainable without external financing',
  },
  {
    id: 'F2',
    name: 'High Capex Ratio',
    condition: 'Capex/Revenue > 35% (2 qtrs)',
    description: 'Excessive investment relative to revenue scale',
  },
  {
    id: 'F3',
    name: 'Growth/Capex Mismatch',
    condition: 'Revenue growth <10% + Capex growth >25%',
    description: 'Spending accelerating while returns decelerate',
  },
  {
    id: 'F4',
    name: 'Extreme Valuation',
    condition: 'EV/Sales >15 OR P/E >60',
    description: 'Price implies unrealistic growth assumptions',
  },
  {
    id: 'F5',
    name: 'Persistent Cash Burn',
    condition: 'Negative FCF 3+ quarters',
    description: 'No path to self-sustaining operations',
  },
  {
    id: 'F6',
    name: 'Leverage Stress',
    condition: 'Debt/EBITDA >3 (2 qtrs)',
    description: 'Debt load threatens solvency in downturn',
  },
];

const STRESS_PARAMS: StressParam[] = [
  { key: 'revenueGrowth', label: 'Revenue Growth %', min: -20, max: 50 },
  { key: 'marginChange', label: 'Margin Change %', min: -20, max: 10 },
  { key: 'capexRatio', label: 'Capex/Revenue %', min: 10, max: 50 },
  { key: 'discountRate', label: 'Discount Rate %', min: 5, max: 20 },
];

const FLAG_KEYS: (keyof Flags)[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];

// ============ UTILITY FUNCTIONS ============

const calculateFlags = (company: Company): Flags => {
  const latest = company.quarters[company.quarters.length - 1];
  const previous = company.quarters[company.quarters.length - 2];

  const flags: Flags = {
    F1: false,
    F2: false,
    F3: false,
    F4: false,
    F5: false,
    F6: false,
  };

  // F1: Capex > FCF
  if (latest.capex > latest.fcf || latest.fcf < 0) {
    flags.F1 = true;
  }

  // F2: Capex/Revenue > 35% for 2 quarters
  const capexRatioLatest = (latest.capex / latest.revenue) * 100;
  const capexRatioPrevious =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    previous ? (previous.capex / previous.revenue) * 100 : 0;
  if (capexRatioLatest > 35 && capexRatioPrevious > 35) {
    flags.F2 = true;
  }

  // F3: Revenue growth < 10% while capex growth > 25%
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (previous) {
    const revenueGrowth =
      ((latest.revenue - previous.revenue) / previous.revenue) * 100;
    const capexGrowth =
      ((latest.capex - previous.capex) / previous.capex) * 100;
    if (revenueGrowth < 10 && capexGrowth > 25) {
      flags.F3 = true;
    }
  }

  // F4: EV/Sales > 15 or P/E > 60
  if (latest.evSales > 15 || (latest.pe !== null && latest.pe > 60)) {
    flags.F4 = true;
  }

  // F5: Negative FCF 3 consecutive quarters
  if (company.quarters.length >= 3) {
    const lastThree = company.quarters.slice(-3);
    if (lastThree.every((q) => q.fcf < 0)) {
      flags.F5 = true;
    }
  }

  // F6: Debt/EBITDA > 3 for 2 quarters
  const debtEbitdaLatest =
    latest.ebitda > 0 ? latest.debt / latest.ebitda : Infinity;
  const debtEbitdaPrevious =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    previous && previous.ebitda > 0 ? previous.debt / previous.ebitda : 0;
  if (debtEbitdaLatest > 3 && debtEbitdaPrevious > 3) {
    flags.F6 = true;
  }

  return flags;
};

const getFlagCount = (flags: Flags): number =>
  Object.values(flags).filter(Boolean).length;

const getRiskLevel = (flagCount: number): RiskLevel => {
  if (flagCount <= 1) {
    return { level: 'LOW', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
  }
  if (flagCount <= 3) {
    return {
      level: 'MEDIUM',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
    };
  }
  return { level: 'HIGH', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
};

// ============ COMPONENT ============

export default function ClientWrapper() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [companies] = useState<Company[]>(INITIAL_COMPANIES);
  const [hypotheses, setHypotheses] = useState<Hypotheses>(INITIAL_HYPOTHESES);
  const [stressScenarios, setStressScenarios] = useState<StressScenario[]>(
    INITIAL_STRESS_SCENARIOS,
  );

  // Calculate aggregate metrics
  const aggregateMetrics = useMemo(() => {
    const allFlags = companies.map((c) => ({
      company: c,
      flags: calculateFlags(c),
    }));
    const totalFlags = allFlags.reduce(
      (sum, item) => sum + getFlagCount(item.flags),
      0,
    );
    const avgEvSales =
      companies.reduce(
        (sum, c) => sum + c.quarters[c.quarters.length - 1].evSales,
        0,
      ) / companies.length;
    const capexExceedsFcf = allFlags.filter((item) => item.flags.F1).length;
    const negativeFcfCount = allFlags.filter((item) => item.flags.F5).length;

    return {
      totalFlags,
      avgEvSales: avgEvSales.toFixed(1),
      capexExceedsFcf,
      negativeFcfCount,
      highRiskCount: allFlags.filter((item) => getFlagCount(item.flags) >= 4)
        .length,
    };
  }, [companies]);

  const metricCards: MetricCard[] = [
    {
      label: 'Total Flags Triggered',
      value: aggregateMetrics.totalFlags,
      Icon: WarningAmberIcon,
      color: aggregateMetrics.totalFlags > 8 ? '#ef4444' : '#f59e0b',
    },
    {
      label: 'Avg EV/Sales',
      value: `${aggregateMetrics.avgEvSales}x`,
      Icon: AttachMoneyIcon,
      color:
        parseFloat(aggregateMetrics.avgEvSales) > 15 ? '#ef4444' : '#10b981',
    },
    {
      label: 'Capex > FCF Count',
      value: aggregateMetrics.capexExceedsFcf,
      Icon: TrendingUpIcon,
      color: '#f59e0b',
    },
    {
      label: 'High Risk Companies',
      value: aggregateMetrics.highRiskCount,
      Icon: BoltIcon,
      color: '#ef4444',
    },
  ];

  const fourOIndicators: FourOIndicator[] = [
    {
      name: 'Overvaluation',
      status:
        parseFloat(aggregateMetrics.avgEvSales) > 15 ? 'ELEVATED' : 'NORMAL',
      color:
        parseFloat(aggregateMetrics.avgEvSales) > 15 ? '#ef4444' : '#10b981',
    },
    {
      name: 'Overinvestment',
      status:
        aggregateMetrics.capexExceedsFcf > companies.length / 2 ?
          'ELEVATED'
        : 'NORMAL',
      color:
        aggregateMetrics.capexExceedsFcf > companies.length / 2 ?
          '#ef4444'
        : '#10b981',
    },
    { name: 'Over-ownership', status: 'MONITOR', color: '#f59e0b' },
    { name: 'Over-leverage', status: 'NORMAL', color: '#10b981' },
  ];

  const barChartData = companies.map((c) => ({
    ticker: c.ticker,
    flags: getFlagCount(calculateFlags(c)),
  }));

  const radarChartData = [
    {
      indicator: 'Overvaluation',
      value: (parseFloat(aggregateMetrics.avgEvSales) / 25) * 100,
      fullMark: 100,
    },
    {
      indicator: 'Overinvestment',
      value: (aggregateMetrics.capexExceedsFcf / companies.length) * 100,
      fullMark: 100,
    },
    { indicator: 'Over-ownership', value: 65, fullMark: 100 },
    { indicator: 'Over-leverage', value: 40, fullMark: 100 },
    {
      indicator: 'Cash Burn',
      value: (aggregateMetrics.negativeFcfCount / companies.length) * 100,
      fullMark: 100,
    },
  ];

  const handleHypothesisChange = (segmentId: SegmentKey, value: string) => {
    setHypotheses((prev) => ({ ...prev, [segmentId]: value }));
  };

  const handleScenarioNameChange = (scenarioId: number, name: string) => {
    setStressScenarios((prev) =>
      prev.map((s) => (s.id === scenarioId ? { ...s, name } : s)),
    );
  };

  const handleScenarioParamChange = (
    scenarioId: number,
    key: keyof Pick<
      StressScenario,
      'revenueGrowth' | 'marginChange' | 'capexRatio' | 'discountRate'
    >,
    value: number,
  ) => {
    setStressScenarios((prev) =>
      prev.map((s) => (s.id === scenarioId ? { ...s, [key]: value } : s)),
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0a0f 100%)',
        color: '#e6edf3',
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid rgba(48, 54, 61, 0.8)',
          padding: '20px 40px',
          background: 'rgba(13, 17, 23, 0.8)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(249, 115, 22, 0.3)',
              }}
            >
              <TrendingDownIcon sx={{ fontSize: 28, color: '#fff' }} />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #f97316, #fb923c)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.5px',
                }}
              >
                BURRY METHOD ANALYZER
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#8b949e',
                  letterSpacing: '2px',
                }}
              >
                BUBBLE DETECTION FRAMEWORK • AI MARKET ANALYSIS
              </p>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 16px',
              background: 'rgba(249, 115, 22, 0.1)',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse 2s infinite',
              }}
            />
            <span style={{ fontSize: '12px', color: '#f97316' }}>
              LIVE ANALYSIS
            </span>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav
        style={{
          display: 'flex',
          gap: '4px',
          padding: '16px 40px',
          borderBottom: '1px solid rgba(48, 54, 61, 0.5)',
          background: 'rgba(13, 17, 23, 0.5)',
          overflowX: 'auto',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background:
                activeTab === tab.id ?
                  'rgba(249, 115, 22, 0.15)'
                : 'transparent',
              border:
                activeTab === tab.id ?
                  '1px solid rgba(249, 115, 22, 0.5)'
                : '1px solid transparent',
              borderRadius: '8px',
              color: activeTab === tab.id ? '#f97316' : '#8b949e',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <tab.Icon sx={{ fontSize: 16 }} />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main style={{ padding: '32px 40px' }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#e6edf3',
                }}
              >
                The Burry Method: Bottom-Up Bubble Detection
              </h2>
              <p
                style={{ color: '#8b949e', lineHeight: 1.7, maxWidth: '800px' }}
              >
                {`Michael Burry's edge wasn't sophisticated statistics—it was
                granular micro-data analysis, simple stress tests, and the
                discipline to ignore consensus narratives when numbers
                disagreed.`}
              </p>
            </div>

            {/* Key Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
                marginBottom: '40px',
              }}
            >
              {metricCards.map((metric, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(22, 27, 34, 0.8)',
                    border: '1px solid rgba(48, 54, 61, 0.8)',
                    borderRadius: '12px',
                    padding: '24px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '80px',
                      height: '80px',
                      background: `radial-gradient(circle at top right, ${metric.color}20, transparent 70%)`,
                    }}
                  />
                  <metric.Icon
                    sx={{
                      fontSize: 20,
                      color: metric.color,
                      marginBottom: '12px',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: metric.color,
                      marginBottom: '4px',
                    }}
                  >
                    {metric.value}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#8b949e',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Core Principles */}
            <div
              style={{
                background: 'rgba(22, 27, 34, 0.8)',
                border: '1px solid rgba(48, 54, 61, 0.8)',
                borderRadius: '12px',
                padding: '32px',
              }}
            >
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  marginBottom: '24px',
                  color: '#f97316',
                }}
              >
                ⚡ CORE PRINCIPLES
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '24px',
                }}
              >
                {PRINCIPLES.map((principle, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      padding: '16px',
                      background: 'rgba(249, 115, 22, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(249, 115, 22, 0.1)',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        background: 'rgba(249, 115, 22, 0.2)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: '#f97316',
                        fontWeight: 700,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: '4px',
                          color: '#e6edf3',
                        }}
                      >
                        {principle.title}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#8b949e',
                          lineHeight: 1.5,
                        }}
                      >
                        {principle.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Universe & Hypothesis Tab */}
        {activeTab === 'universe' && (
          <div>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                marginBottom: '24px',
              }}
            >
              Define Your Universe & Hypothesis
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px',
                marginBottom: '32px',
              }}
            >
              {/* Segments */}
              <div
                style={{
                  background: 'rgba(22, 27, 34, 0.8)',
                  border: '1px solid rgba(48, 54, 61, 0.8)',
                  borderRadius: '12px',
                  padding: '24px',
                }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '20px',
                    color: '#f97316',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <LayersIcon sx={{ fontSize: 16 }} /> MARKET SEGMENTS
                </h3>
                {SEGMENTS.map((segment) => (
                  <div
                    key={segment.id}
                    style={{
                      padding: '16px',
                      marginBottom: '12px',
                      background: 'rgba(249, 115, 22, 0.05)',
                      border: '1px solid rgba(249, 115, 22, 0.2)',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {segment.label}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8b949e' }}>
                      {segment.examples}
                    </div>
                    <textarea
                      value={hypotheses[segment.id]}
                      onChange={(e) => {
                        handleHypothesisChange(segment.id, e.target.value);
                      }}
                      placeholder="Enter your hypothesis for this segment..."
                      style={{
                        width: '100%',
                        marginTop: '12px',
                        padding: '12px',
                        background: 'rgba(13, 17, 23, 0.8)',
                        border: '1px solid rgba(48, 54, 61, 0.8)',
                        borderRadius: '6px',
                        color: '#e6edf3',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        minHeight: '80px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Company List */}
              <div
                style={{
                  background: 'rgba(22, 27, 34, 0.8)',
                  border: '1px solid rgba(48, 54, 61, 0.8)',
                  borderRadius: '12px',
                  padding: '24px',
                }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '20px',
                    color: '#f97316',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <StorageIcon sx={{ fontSize: 16 }} /> TRACKED COMPANIES
                </h3>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {companies.map((company) => {
                    const flags = calculateFlags(company);
                    const flagCount = getFlagCount(flags);
                    const risk = getRiskLevel(flagCount);
                    return (
                      <div
                        key={company.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          marginBottom: '8px',
                          background: risk.bg,
                          border: `1px solid ${risk.color}40`,
                          borderRadius: '8px',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            {company.ticker}
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                background: 'rgba(139, 148, 158, 0.2)',
                                borderRadius: '4px',
                                color: '#8b949e',
                              }}
                            >
                              {company.segment}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#8b949e' }}>
                            {company.name}
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <div
                            style={{
                              padding: '4px 12px',
                              background: risk.color,
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#fff',
                            }}
                          >
                            {flagCount} FLAGS
                          </div>
                          <button
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#8b949e',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <VisibilityIcon sx={{ fontSize: 16 }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics & Flags Tab */}
        {activeTab === 'metrics' && (
          <div>
            <h2
              style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}
            >
              Burry-Style Flag System
            </h2>
            <p style={{ color: '#8b949e', marginBottom: '24px' }}>
              Six key indicators adapted from mortgage analysis to AI/tech
              bubble detection
            </p>

            {/* Flag Definitions */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '16px',
                marginBottom: '32px',
              }}
            >
              {FLAG_DEFINITIONS.map((flag) => (
                <div
                  key={flag.id}
                  style={{
                    background: 'rgba(22, 27, 34, 0.8)',
                    border: '1px solid rgba(48, 54, 61, 0.8)',
                    borderRadius: '12px',
                    padding: '20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        background: 'linear-gradient(135deg, #f97316, #ea580c)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}
                    >
                      {flag.id}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{flag.name}</div>
                      <code
                        style={{
                          fontSize: '11px',
                          color: '#f97316',
                          background: 'rgba(249, 115, 22, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {flag.condition}
                      </code>
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#8b949e',
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {flag.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Company Flag Matrix */}
            <div
              style={{
                background: 'rgba(22, 27, 34, 0.8)',
                border: '1px solid rgba(48, 54, 61, 0.8)',
                borderRadius: '12px',
                padding: '24px',
                overflowX: 'auto',
              }}
            >
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '20px',
                  color: '#f97316',
                }}
              >
                FLAG MATRIX
              </h3>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: '1px solid rgba(48, 54, 61, 0.8)' }}
                  >
                    <th
                      style={{
                        padding: '12px',
                        textAlign: 'left',
                        color: '#8b949e',
                        fontWeight: 500,
                      }}
                    >
                      Company
                    </th>
                    {FLAG_KEYS.map((f) => (
                      <th
                        key={f}
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          color: '#8b949e',
                          fontWeight: 500,
                        }}
                      >
                        {f}
                      </th>
                    ))}
                    <th
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: '#8b949e',
                        fontWeight: 500,
                      }}
                    >
                      Total
                    </th>
                    <th
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: '#8b949e',
                        fontWeight: 500,
                      }}
                    >
                      Risk
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => {
                    const flags = calculateFlags(company);
                    const flagCount = getFlagCount(flags);
                    const risk = getRiskLevel(flagCount);
                    return (
                      <tr
                        key={company.id}
                        style={{
                          borderBottom: '1px solid rgba(48, 54, 61, 0.5)',
                        }}
                      >
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          {company.ticker}
                        </td>
                        {FLAG_KEYS.map((f) => (
                          <td
                            key={f}
                            style={{ padding: '12px', textAlign: 'center' }}
                          >
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '4px',
                                background:
                                  flags[f] ? '#ef4444' : (
                                    'rgba(16, 185, 129, 0.3)'
                                  ),
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: flags[f] ? '#fff' : '#10b981',
                                fontSize: '12px',
                                fontWeight: 700,
                              }}
                            >
                              {flags[f] ? '!' : '✓'}
                            </div>
                          </td>
                        ))}
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontWeight: 700,
                            color: risk.color,
                          }}
                        >
                          {flagCount}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '4px 12px',
                              borderRadius: '4px',
                              background: risk.bg,
                              color: risk.color,
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            {risk.level}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stress Tests Tab */}
        {activeTab === 'stress' && (
          <div>
            <h2
              style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}
            >
              Scenario Stress Testing
            </h2>
            <p style={{ color: '#8b949e', marginBottom: '24px' }}>
              {`"What if?" analysis—the core of Burry's method. Model cash flows
              under adverse conditions.`}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '20px',
              }}
            >
              {stressScenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  style={{
                    background: 'rgba(22, 27, 34, 0.8)',
                    border: '1px solid rgba(48, 54, 61, 0.8)',
                    borderRadius: '12px',
                    padding: '24px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '20px',
                    }}
                  >
                    <CalculateIcon sx={{ fontSize: 20, color: '#f97316' }} />
                    <input
                      type="text"
                      value={scenario.name}
                      onChange={(e) => {
                        handleScenarioNameChange(scenario.id, e.target.value);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#e6edf3',
                        fontSize: '16px',
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        flex: 1,
                      }}
                    />
                  </div>

                  {STRESS_PARAMS.map((param) => (
                    <div key={param.key} style={{ marginBottom: '16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ color: '#8b949e' }}>{param.label}</span>
                        <span style={{ color: '#f97316', fontWeight: 600 }}>
                          {scenario[param.key]}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={param.min}
                        max={param.max}
                        value={scenario[param.key]}
                        onChange={(e) => {
                          handleScenarioParamChange(
                            scenario.id,
                            param.key,
                            parseInt(e.target.value),
                          );
                        }}
                        style={{ width: '100%', accentColor: '#f97316' }}
                      />
                    </div>
                  ))}

                  {/* Projected Outcome */}
                  <div
                    style={{
                      marginTop: '20px',
                      padding: '16px',
                      background: 'rgba(249, 115, 22, 0.1)',
                      borderRadius: '8px',
                      border: '1px solid rgba(249, 115, 22, 0.2)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#8b949e',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                      }}
                    >
                      5-Year FCF Impact
                    </div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color:
                          (
                            scenario.revenueGrowth < 15 ||
                            scenario.marginChange < -3
                          ) ?
                            '#ef4444'
                          : '#10b981',
                      }}
                    >
                      {(
                        scenario.revenueGrowth < 15 ||
                        scenario.marginChange < -3
                      ) ?
                        '▼ HIGH RISK'
                      : '◆ MODERATE'}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#8b949e',
                        marginTop: '4px',
                      }}
                    >
                      {scenario.revenueGrowth < 15 ?
                        'Current valuations unsupportable under these assumptions'
                      : 'Valuations stretched but potentially justifiable'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                marginBottom: '24px',
              }}
            >
              AI Bubble Risk Dashboard
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: '24px',
                marginBottom: '24px',
              }}
            >
              {/* Radar Chart */}
              <div
                style={{
                  background: 'rgba(22, 27, 34, 0.8)',
                  border: '1px solid rgba(48, 54, 61, 0.8)',
                  borderRadius: '12px',
                  padding: '24px',
                }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '20px',
                    color: '#f97316',
                  }}
                >
                  BUBBLE INDICATOR RADAR
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarChartData}>
                    <PolarGrid stroke="#30363d" />
                    <PolarAngleAxis
                      dataKey="indicator"
                      tick={{ fill: '#8b949e', fontSize: 11 }}
                    />
                    <PolarRadiusAxis tick={{ fill: '#8b949e', fontSize: 10 }} />
                    <Radar
                      name="Risk Level"
                      dataKey="value"
                      stroke="#f97316"
                      fill="#f97316"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Summary */}
              <div
                style={{
                  background: 'rgba(22, 27, 34, 0.8)',
                  border: '1px solid rgba(48, 54, 61, 0.8)',
                  borderRadius: '12px',
                  padding: '24px',
                }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '20px',
                    color: '#f97316',
                  }}
                >
                  {`SHARMA'S FOUR O's`}
                </h3>
                {fourOIndicators.map((indicator, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom:
                        i < 3 ? '1px solid rgba(48, 54, 61, 0.5)' : 'none',
                    }}
                  >
                    <span style={{ color: '#e6edf3' }}>{indicator.name}</span>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '4px',
                        background: `${indicator.color}20`,
                        color: indicator.color,
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {indicator.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Company Risk Bar Chart */}
            <div
              style={{
                background: 'rgba(22, 27, 34, 0.8)',
                border: '1px solid rgba(48, 54, 61, 0.8)',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '20px',
                  color: '#f97316',
                }}
              >
                COMPANY FLAG COUNT
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barChartData}>
                  <XAxis
                    dataKey="ticker"
                    tick={{ fill: '#8b949e', fontSize: 12 }}
                    axisLine={{ stroke: '#30363d' }}
                  />
                  <YAxis
                    tick={{ fill: '#8b949e', fontSize: 12 }}
                    axisLine={{ stroke: '#30363d' }}
                    domain={[0, 6]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '8px',
                      color: '#e6edf3',
                    }}
                  />
                  <Bar dataKey="flags" radius={[4, 4, 0, 0]}>
                    {barChartData.map((entry, i) => {
                      const color =
                        entry.flags >= 4 ? '#ef4444'
                        : entry.flags >= 2 ? '#f59e0b'
                        : '#10b981';
                      return <Cell key={i} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Historical Tests Tab */}
        {activeTab === 'historical' && (
          <div>
            <h2
              style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}
            >
              Historical Backtesting Scenarios
            </h2>
            <p style={{ color: '#8b949e', marginBottom: '24px' }}>
              {`Validate your framework against known outcomes. Apply flags
              "blind" to pre-crash data.`}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '20px',
              }}
            >
              {HISTORICAL_SCENARIOS.map((scenario, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(22, 27, 34, 0.8)',
                    border: '1px solid rgba(48, 54, 61, 0.8)',
                    borderRadius: '12px',
                    padding: '24px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '16px',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        background: 'linear-gradient(135deg, #f97316, #ea580c)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <HistoryIcon sx={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div>
                      <h3
                        style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}
                      >
                        {scenario.name}
                      </h3>
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: '13px',
                          color: '#8b949e',
                        }}
                      >
                        {scenario.description}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#ef4444',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Known Outcome
                    </div>
                    <div style={{ fontSize: '13px', color: '#e6edf3' }}>
                      {scenario.outcome}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '12px',
                      color: '#8b949e',
                      marginBottom: '8px',
                    }}
                  >
                    Expected Flag Counts:
                  </div>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
                  >
                    {scenario.companies.map((companyName) => {
                      const flagCount = scenario.expectedFlags[companyName];
                      const risk = getRiskLevel(flagCount);
                      return (
                        <div
                          key={companyName}
                          style={{
                            padding: '6px 12px',
                            background: risk.bg,
                            border: `1px solid ${risk.color}40`,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span style={{ fontSize: '12px' }}>
                            {companyName}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: risk.color,
                            }}
                          >
                            {flagCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    style={{
                      width: '100%',
                      marginTop: '16px',
                      padding: '12px',
                      background: 'rgba(249, 115, 22, 0.2)',
                      border: '1px solid rgba(249, 115, 22, 0.5)',
                      borderRadius: '8px',
                      color: '#f97316',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    Run Blind Test <ChevronRightIcon sx={{ fontSize: 16 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid rgba(48, 54, 61, 0.8)',
          padding: '20px 40px',
          background: 'rgba(13, 17, 23, 0.5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#8b949e',
        }}
      >
        <div>
          {`Based on Michael Burry's methodology from "The Big Short" • Not
          financial advice`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Framework Version 1.0</span>
          <span style={{ color: '#30363d' }}>|</span>
          <span style={{ color: '#f97316' }}>AI Bubble Analysis Module</span>
        </div>
      </footer>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        input[type="range"] {
          -webkit-appearance: none;
          height: 4px;
          background: #30363d;
          border-radius: 2px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: #f97316;
          border-radius: 50%;
          cursor: pointer;
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(48, 54, 61, 0.3);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(249, 115, 22, 0.5);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(249, 115, 22, 0.8);
        }
      `}</style>
    </div>
  );
}
