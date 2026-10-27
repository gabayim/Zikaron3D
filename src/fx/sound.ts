import { useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useAudioSettings } from '../store/audioSettings';

const SFX = {
  pop: require('../../assets/audio/sfx/pop.m4a'),
  boing: require('../../assets/audio/sfx/boing.m4a'),
  chime: require('../../assets/audio/sfx/chime.m4a'),
  sparkle: require('../../assets/audio/sfx/sparkle.m4a'),
  sad: require('../../assets/audio/sfx/sad.m4a'),
  whoosh: require('../../assets/audio/sfx/whoosh.m4a'),
} as const;

export type SfxName = keyof typeof SFX;

let players: Record<SfxName, AudioPlayer> | null = null;
let musicPlayers: AudioPlayer[] = [];
let duckUntil = 0;

function duckMusic(ms: number, amount = 0.35) {
  duckUntil = Date.now() + ms;
  for (const p of musicPlayers) {
    if (p.playing) p.volume = Math.min(p.volume, amount);
  }
}

export function applyMusicMute(mute: boolean) {
  for (const p of musicPlayers) {
    if (mute) {
      p.pause();
      p.volume = 0;
    } else if (!p.playing) p.play();
  }
}

function tickDuck() {
  if (Date.now() < duckUntil) return;
  const musicOn = useAudioSettings.getState().musicOn;
  for (const p of musicPlayers) {
    if (p.playing && p.volume < 0.38) p.volume = Math.min(0.45, p.volume + 0.03);
  }
  if (!musicOn) {
    for (const p of musicPlayers) p.volume = 0;
  }
}

function getPlayers() {
  if (!players) {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    players = {} as Record<SfxName, AudioPlayer>;
    for (const name of Object.keys(SFX) as SfxName[]) players[name] = createAudioPlayer(SFX[name]);
  }
  return players;
}

/** One player per effect; replaying restarts it, which is what rapid taps should feel like. */
export const sfx = {
  play(name: SfxName, volume = 1, rate = 1) {
    if (!useAudioSettings.getState().sfxOn) return;
    const p = getPlayers()[name];
    p.volume = volume;
    p.setPlaybackRate(rate);
    p.seekTo(0);
    p.play();
    if (name === 'chime' || name === 'whoosh') duckMusic(420, 0.32);
    tickDuck();
  },
};

export function useMusic(source: number | null, volume = 0.45) {
  useEffect(() => {
    if (source == null) return;
    getPlayers();
    if (!useAudioSettings.getState().musicOn) return;
    const player = createAudioPlayer(source);
    player.loop = true;
    player.volume = volume;
    musicPlayers.push(player);
    player.play();
    const id = setInterval(tickDuck, 80);
    return () => {
      clearInterval(id);
      musicPlayers = musicPlayers.filter((p) => p !== player);
      player.remove();
    };
  }, [source, volume]);
}

/**
 * One looping track per source, crossfaded as `active` changes. Players are created lazily and
 * only the active (or fading) track is actually playing.
 */
export function useCrossfadeMusic(sources: readonly number[], active: number, volume = 0.4) {
  const playersRef = useRef<AudioPlayer[]>([]);
  const targetRef = useRef({ active, volume });

  useEffect(() => {
    getPlayers();
    const list = sources.map((s) => {
      const p = createAudioPlayer(s);
      p.loop = true;
      p.volume = 0;
      musicPlayers.push(p);
      return p;
    });
    playersRef.current = list;
    const id = setInterval(() => {
      tickDuck();
      const { active: a, volume: v } = targetRef.current;
      const musicOn = useAudioSettings.getState().musicOn;
      const base = musicOn ? v : 0;
      list.forEach((p, i) => {
        const goal = i === a ? base : 0;
        const next = p.volume + Math.sign(goal - p.volume) * Math.min(Math.abs(goal - p.volume), 0.03);
        if (i === a && !p.playing) p.play();
        if (next !== p.volume) p.volume = next;
        if (i !== a && next === 0 && p.playing) p.pause();
      });
    }, 50);
    return () => {
      clearInterval(id);
      list.forEach((p) => {
        musicPlayers = musicPlayers.filter((m) => m !== p);
        p.remove();
      });
      playersRef.current = [];
    };
  }, [sources]);

  useEffect(() => {
    targetRef.current = { active, volume };
  }, [active, volume]);
}
