import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

let kv: ReturnType<typeof createMMKV> | null = null;
try {
  kv = createMMKV({ id: 'zikaron3d-audio' });
} catch {
  kv = null;
}

interface AudioSettingsState {
  musicOn: boolean;
  sfxOn: boolean;
  /** Less shake, flash, and particles (accessibility + Sanctuary alignment). */
  reduceMotion: boolean;
  setMusicOn: (on: boolean) => void;
  setSfxOn: (on: boolean) => void;
  setReduceMotion: (on: boolean) => void;
  toggleMusic: () => void;
  toggleSfx: () => void;
  toggleReduceMotion: () => void;
}

export const useAudioSettings = create<AudioSettingsState>((set, get) => ({
  musicOn: kv?.getBoolean('musicOn') ?? true,
  sfxOn: kv?.getBoolean('sfxOn') ?? true,
  reduceMotion: kv?.getBoolean('reduceMotion') ?? false,
  setMusicOn: (musicOn) => {
    kv?.set('musicOn', musicOn);
    set({ musicOn });
  },
  setSfxOn: (sfxOn) => {
    kv?.set('sfxOn', sfxOn);
    set({ sfxOn });
  },
  setReduceMotion: (reduceMotion) => {
    kv?.set('reduceMotion', reduceMotion);
    set({ reduceMotion });
  },
  toggleMusic: () => get().setMusicOn(!get().musicOn),
  toggleSfx: () => get().setSfxOn(!get().sfxOn),
  toggleReduceMotion: () => get().setReduceMotion(!get().reduceMotion),
}));

/** Multiplier for screen shake / flash intensity (0.25–1). */
export function motionScale(): number {
  const { reduceMotion } = useAudioSettings.getState();
  return reduceMotion ? 0.28 : 1;
}
