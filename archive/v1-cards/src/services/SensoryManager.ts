import * as Haptics from 'expo-haptics';

/**
 * Pentatonic pitch scale for streak combos (Hz).
 * Scales in frequency from C5 up to E6 (Super Fever harmonic).
 */
export const STREAK_PITCH_FREQUENCIES: readonly number[] = [
  523.25, // 1x Combo: C5
  587.33, // 2x Combo: D5
  659.25, // 3x Combo: E5
  783.99, // 4x Combo: G5
  880.0,  // 5x Combo: A5
  1046.5, // 6x Combo: C6
  1174.66,// 7x Combo: D6
  1318.51,// 8x Combo: E6 (Max Fever Peak!)
];

export interface SensoryEvent {
  type: 'FLIP' | 'MATCH' | 'MISS' | 'SHIELD_DEFLECT' | 'NEAR_MISS' | 'VICTORY';
  streak?: number;
  pitchHz?: number;
  timestamp: number;
}

type SensoryListener = (event: SensoryEvent) => void;

class SensoryService {
  private listeners: Set<SensoryListener> = new Set();

  /**
   * Returns the frequency in Hz matching the current combo streak.
   */
  public getPitchForStreak(streak: number): number {
    const clampedIndex = Math.max(1, Math.min(8, streak)) - 1;
    return STREAK_PITCH_FREQUENCIES[clampedIndex];
  }

  /**
   * Subscribe to sensory triggers (e.g. for audio synthesis or particle visualizers).
   */
  public subscribe(listener: SensoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SensoryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {}
    }
  }

  /**
   * Card Flip: Light tactile snap.
   */
  public async triggerFlip(): Promise<void> {
    this.emit({ type: 'FLIP', timestamp: Date.now() });
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  }

  /**
   * Card Match: Ascending pitch chime & scaled haptic intensity.
   */
  public async triggerMatch(streak = 1): Promise<void> {
    const pitchHz = this.getPitchForStreak(streak);
    this.emit({ type: 'MATCH', streak, pitchHz, timestamp: Date.now() });

    try {
      if (streak >= 5) {
        // High Fever: Double heavy pulse
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(async () => {
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {}
        }, 80);
      } else if (streak >= 2) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {}
  }

  /**
   * Card Miss: Warning feedback & pitch reset.
   */
  public async triggerMiss(): Promise<void> {
    this.emit({ type: 'MISS', timestamp: Date.now() });
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
  }

  /**
   * Streak Shield Deflection: Metallic heavy deflection pulse.
   */
  public async triggerShieldDeflect(): Promise<void> {
    this.emit({ type: 'SHIELD_DEFLECT', timestamp: Date.now() });
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(async () => {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }, 90);
    } catch {}
  }

  /**
   * Near-Miss 1.5s Reveal: Suspense pulse.
   */
  public async triggerNearMiss(): Promise<void> {
    this.emit({ type: 'NEAR_MISS', timestamp: Date.now() });
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
  }

  /**
   * Victory: Multi-stage celebratory fanfare pulse.
   */
  public async triggerVictory(): Promise<void> {
    this.emit({ type: 'VICTORY', timestamp: Date.now() });
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(async () => {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch {}
      }, 150);
      setTimeout(async () => {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }, 300);
    } catch {}
  }
}

export const SensoryManager = new SensoryService();
