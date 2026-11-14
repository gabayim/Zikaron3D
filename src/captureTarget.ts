export interface CaptureConfig {
  screen: 'hub' | 'collection' | 'settings' | 'leaderboard' | 'shop' | 'meadow' | 'crystal';
  mode: 'TOYBOX' | 'ARCADE';
  showGate?: boolean;
  shopTab?: 'skins' | 'accessories' | 'stardust' | 'crystals' | 'worlds';
}

export const CAPTURE_CONFIG: CaptureConfig = {
  screen: 'hub',
  mode: 'ARCADE',
  showGate: false,
};
