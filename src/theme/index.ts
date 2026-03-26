// Dark premium theme tokens
export const colors = {
  // Backgrounds
  bg:       '#0D0F12',
  card:     '#141720',
  elevated: '#1A1D27',
  border:   '#2D3148',

  // Accent
  accent:      '#6366F1',
  accentLight: '#818CF8',
  accentDim:   'rgba(99,102,241,0.15)',

  // Status
  success:    '#22C55E',
  successDim: 'rgba(34,197,94,0.15)',
  warning:    '#F59E0B',
  warningDim: 'rgba(245,158,11,0.15)',
  danger:     '#EF4444',
  dangerDim:  'rgba(239,68,68,0.15)',
  info:       '#3B82F6',

  // Text
  text:          '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted:     '#6B7280',
  placeholder:   '#4B5563',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const typography = {
  xs:   { fontSize: 11, lineHeight: 16 },
  sm:   { fontSize: 13, lineHeight: 18 },
  base: { fontSize: 15, lineHeight: 22 },
  md:   { fontSize: 16, lineHeight: 24 },
  lg:   { fontSize: 18, lineHeight: 26 },
  xl:   { fontSize: 22, lineHeight: 30 },
  xxl:  { fontSize: 28, lineHeight: 36 },
};

// Uppercase aliases for components that import with PascalCase
export const Colors = colors;
export const Typography = typography;
export const Spacing = spacing;
export const Radius = radius;
export const Shadow = shadow;

// Layout constants
export const SIDEBAR_WIDTH = 240;
export const BOTTOM_TAB_HEIGHT = 60;
export const Breakpoints = {
  tablet: 768,
  desktop: 1024,
};
