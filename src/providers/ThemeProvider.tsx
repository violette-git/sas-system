/**
 * ThemeProvider — company-level white-label overrides.
 *
 * The default dark premium theme is defined in src/theme/index.ts.
 * When the authenticated company has branding set, this provider
 * merges those values so descendants can call useCompanyTheme()
 * instead of importing colors directly.
 *
 * Cascade:
 *   default theme (colors.accent = #6366F1)
 *   → company.primary_color override (if set)
 */

import React, { createContext, useContext, useMemo } from 'react';
import { colors as defaultColors } from '@/theme';
import { useAuthStore } from '@/features/auth/store/authStore';

// Hex to rgba helper for dim variants
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(99,102,241,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Lighten a hex color by mixing with white
function lightenHex(hex: string, amount = 0.25): string {
  const clean = hex.replace('#', '');
  const r = Math.round(parseInt(clean.substring(0, 2), 16) + (255 - parseInt(clean.substring(0, 2), 16)) * amount);
  const g = Math.round(parseInt(clean.substring(2, 4), 16) + (255 - parseInt(clean.substring(2, 4), 16)) * amount);
  const b = Math.round(parseInt(clean.substring(4, 6), 16) + (255 - parseInt(clean.substring(4, 6), 16)) * amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export type CompanyColors = typeof defaultColors;

export interface CompanyTheme {
  colors: CompanyColors;
  logoUrl: string | null;
  displayName: string | null;
  hasBranding: boolean;
}

const ThemeContext = createContext<CompanyTheme>({
  colors: defaultColors,
  logoUrl: null,
  displayName: null,
  hasBranding: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { company } = useAuthStore();

  const theme = useMemo<CompanyTheme>(() => {
    if (!company?.primary_color) {
      return {
        colors: defaultColors,
        logoUrl: company?.logo_url ?? null,
        displayName: company?.company_name_display ?? null,
        hasBranding: false,
      };
    }

    const primary = company.primary_color;
    const secondary = company.secondary_color ?? defaultColors.info;

    const mergedColors: CompanyColors = {
      ...defaultColors,
      accent:      primary,
      accentLight: lightenHex(primary, 0.25),
      accentDim:   hexToRgba(primary, 0.15),
      info:        secondary,
    };

    return {
      colors: mergedColors,
      logoUrl: company.logo_url ?? null,
      displayName: company.company_name_display ?? null,
      hasBranding: true,
    };
  }, [company?.primary_color, company?.secondary_color, company?.logo_url, company?.company_name_display]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Returns theme colors merged with any company overrides. */
export function useCompanyTheme(): CompanyTheme {
  return useContext(ThemeContext);
}
