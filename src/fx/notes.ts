import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useAudioSettings } from '../store/audioSettings';
import { BEAT_SOURCES, NOTE_HIGH, NOTE_LOW, NOTE_SOURCES } from './noteRegistry';

export type BeatSound = keyof typeof BEAT_SOURCES;

/** Two voices per pitch so a repeated note can ring while the next one strikes. */
const VOICES = 2;
const notePlayers = new Map<number, AudioPlayer[]>();
const beatPlayers = new Map<BeatSound, AudioPlayer[]>();
const nextVoice = new Map<number | string, number>();
let audioMode = false;

export const clampMidi = (midi: number) => {
  let m = Math.round(midi);
  while (m < NOTE_LOW) m += 12;
  while (m > NOTE_HIGH) m -= 12;
  return m;
};

function ensureMode() {
  if (audioMode) return;
  audioMode = true;
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
}

function voicesFor(midi: number) {
  const m = clampMidi(midi);
  let list = notePlayers.get(m);
  if (!list) {
    ensureMode();
    list = Array.from({ length: VOICES }, () => createAudioPlayer(NOTE_SOURCES[m]));
    notePlayers.set(m, list);
  }
  return list;
}

function beatVoices(name: BeatSound) {
  let list = beatPlayers.get(name);
  if (!list) {
    ensureMode();
    list = Array.from({ length: VOICES }, () => createAudioPlayer(BEAT_SOURCES[name]));
    beatPlayers.set(name, list);
  }
  return list;
}

function strike(list: AudioPlayer[], key: number | string, volume: number) {
  if (!useAudioSettings.getState().sfxOn) return;
  const i = nextVoice.get(key) ?? 0;
  nextVoice.set(key, (i + 1) % list.length);
  const p = list[i];
  p.volume = volume;
  p.seekTo(0);
  p.play();
}

/** Synthesized bell instrument and beat bed for Beat Circuit. */
export const notes = {
  /** Creates players ahead of a song so the first strike has no load delay. */
  prepare(midis: Iterable<number>) {
    for (const m of midis) voicesFor(m);
    (Object.keys(BEAT_SOURCES) as BeatSound[]).forEach(beatVoices);
  },
  play(midi: number, volume = 0.9) {
    strike(voicesFor(midi), clampMidi(midi), volume);
  },
  beat(name: BeatSound, volume = 0.6) {
    strike(beatVoices(name), name, volume);
  },
  /** Frees every player (call when leaving the game). */
  release() {
    for (const list of [...notePlayers.values(), ...beatPlayers.values()]) list.forEach((p) => p.remove());
    notePlayers.clear();
    beatPlayers.clear();
    nextVoice.clear();
  },
};
