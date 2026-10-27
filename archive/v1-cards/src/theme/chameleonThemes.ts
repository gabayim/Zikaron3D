import { TextStyle } from 'react-native';
import { ThemePersona } from '../engine/types';

export interface ChameleonThemeTokens {
  id: ThemePersona;
  name: string;
  tagline: string;
  colors: {
    background: string;
    stageBackground: string;
    surface: string;
    surfaceElevated: string;
    surfaceBorder: string;
    surfaceBorderActive: string;
    primary: string;
    accent: string;
    glow: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textAccent: string;
    feverTrack: string;
    feverFill: string;
    feverGlow: string;
    feverEmbers: string[];
    feverMax: string;
    shieldActive: string;
    shieldInactive: string;
    shieldGlow: string;
    danger: string;
    success: string;
    modalBackdrop: string;
  };
  typography: {
    titleSize: number;
    titleWeight: TextStyle['fontWeight'];
    headerSize: number;
    headerWeight: TextStyle['fontWeight'];
    valueSize: number;
    valueWeight: TextStyle['fontWeight'];
    bodySize: number;
    bodyWeight: TextStyle['fontWeight'];
    captionSize: number;
    captionWeight: TextStyle['fontWeight'];
    letterSpacing: number;
  };
  shape: {
    radiusSmall: number;
    radiusMedium: number;
    radiusLarge: number;
    radiusPill: number;
    borderWidth: number;
  };
  animation: {
    emberCount: number;
    pulseDurationMs: number;
    tensionScale: number;
  };
}

export const TOYBOX_THEME: ChameleonThemeTokens = {
  id: 'TOYBOX',
  name: 'Toybox',
  tagline: 'Playful • Untimed • Friendly',
  colors: {
    background: '#0D1B2A',
    stageBackground: '#0B1622',
    surface: 'rgba(27, 38, 59, 0.92)',
    surfaceElevated: 'rgba(42, 60, 92, 0.95)',
    surfaceBorder: 'rgba(255, 183, 3, 0.28)',
    surfaceBorderActive: '#FFB703',
    primary: '#FFB703',
    accent: '#FB8500',
    glow: '#8ECAE6',
    textPrimary: '#FFFFFF',
    textSecondary: '#8ECAE6',
    textMuted: '#5C768D',
    textAccent: '#FFB703',
    feverTrack: '#1B263B',
    feverFill: '#FFB703',
    feverGlow: '#FB8500',
    feverEmbers: ['#FFB703', '#FB8500', '#FF006E', '#8ECAE6', '#06D6A0'],
    feverMax: '#FF006E',
    shieldActive: '#06D6A0',
    shieldInactive: '#415A77',
    shieldGlow: 'rgba(6, 214, 160, 0.35)',
    danger: '#FF006E',
    success: '#06D6A0',
    modalBackdrop: 'rgba(10, 18, 30, 0.88)',
  },
  typography: {
    titleSize: 24,
    titleWeight: '900',
    headerSize: 14,
    headerWeight: '800',
    valueSize: 22,
    valueWeight: '900',
    bodySize: 15,
    bodyWeight: '600',
    captionSize: 11,
    captionWeight: '700',
    letterSpacing: 0.5,
  },
  shape: {
    radiusSmall: 14,
    radiusMedium: 20,
    radiusLarge: 28,
    radiusPill: 999,
    borderWidth: 2,
  },
  animation: {
    emberCount: 6,
    pulseDurationMs: 1600,
    tensionScale: 1.05,
  },
};

export const ARCADE_THEME: ChameleonThemeTokens = {
  id: 'ARCADE',
  name: 'Arcade',
  tagline: 'Cyber • Fever Combos • High Stakes',
  colors: {
    background: '#05080E',
    stageBackground: '#04070B',
    surface: 'rgba(10, 16, 26, 0.92)',
    surfaceElevated: 'rgba(18, 28, 44, 0.95)',
    surfaceBorder: 'rgba(0, 229, 255, 0.22)',
    surfaceBorderActive: '#00E5FF',
    primary: '#00E5FF',
    accent: '#FFD700',
    glow: '#00B0FF',
    textPrimary: '#FFFFFF',
    textSecondary: '#90A4AE',
    textMuted: '#455A64',
    textAccent: '#FFD700',
    feverTrack: '#101726',
    feverFill: '#FFD700',
    feverGlow: '#FF9100',
    feverEmbers: ['#FFD700', '#FF6D00', '#FF1744', '#00E5FF', '#B026FF'],
    feverMax: '#FF1744',
    shieldActive: '#00E5FF',
    shieldInactive: '#263238',
    shieldGlow: 'rgba(0, 229, 255, 0.4)',
    danger: '#FF1744',
    success: '#00E676',
    modalBackdrop: 'rgba(4, 7, 12, 0.92)',
  },
  typography: {
    titleSize: 22,
    titleWeight: '900',
    headerSize: 12,
    headerWeight: '800',
    valueSize: 20,
    valueWeight: '900',
    bodySize: 13,
    bodyWeight: '600',
    captionSize: 10,
    captionWeight: '700',
    letterSpacing: 1.1,
  },
  shape: {
    radiusSmall: 8,
    radiusMedium: 14,
    radiusLarge: 20,
    radiusPill: 20,
    borderWidth: 1.5,
  },
  animation: {
    emberCount: 10,
    pulseDurationMs: 1100,
    tensionScale: 1.12,
  },
};

export const SANCTUARY_THEME: ChameleonThemeTokens = {
  id: 'SANCTUARY',
  name: 'Sanctuary',
  tagline: 'Tranquil • High Contrast • Mindful',
  colors: {
    background: '#0A120E',
    stageBackground: '#080E0B',
    surface: 'rgba(16, 28, 22, 0.92)',
    surfaceElevated: 'rgba(26, 44, 34, 0.95)',
    surfaceBorder: 'rgba(167, 201, 87, 0.28)',
    surfaceBorderActive: '#A7C957',
    primary: '#A7C957',
    accent: '#E9D8A6',
    glow: '#6A994E',
    textPrimary: '#FFFFFF',
    textSecondary: '#D8E2DC',
    textMuted: '#587060',
    textAccent: '#E9D8A6',
    feverTrack: '#14221A',
    feverFill: '#A7C957',
    feverGlow: '#6A994E',
    feverEmbers: ['#A7C957', '#E9D8A6', '#6A994E', '#F4A261'],
    feverMax: '#E76F51',
    shieldActive: '#A7C957',
    shieldInactive: '#2C3E32',
    shieldGlow: 'rgba(167, 201, 87, 0.35)',
    danger: '#E76F51',
    success: '#A7C957',
    modalBackdrop: 'rgba(8, 14, 11, 0.9)',
  },
  typography: {
    titleSize: 26,
    titleWeight: '800',
    headerSize: 15,
    headerWeight: '700',
    valueSize: 24,
    valueWeight: '800',
    bodySize: 16,
    bodyWeight: '500',
    captionSize: 12,
    captionWeight: '600',
    letterSpacing: 0.2,
  },
  shape: {
    radiusSmall: 12,
    radiusMedium: 18,
    radiusLarge: 24,
    radiusPill: 999,
    borderWidth: 2,
  },
  animation: {
    emberCount: 4,
    pulseDurationMs: 2400,
    tensionScale: 1.03,
  },
};

export const CHAMELEON_THEMES: Record<ThemePersona, ChameleonThemeTokens> = {
  TOYBOX: TOYBOX_THEME,
  ARCADE: ARCADE_THEME,
  SANCTUARY: SANCTUARY_THEME,
};

export function getChameleonTheme(persona: ThemePersona): ChameleonThemeTokens {
  return CHAMELEON_THEMES[persona] || ARCADE_THEME;
}
