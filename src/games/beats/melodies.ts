import type { SeededRNG } from '../../engine/SeededRNG';

/**
 * Melody library for Beat Circuit.
 *
 * Legal: every classic below is a composition whose composer died more than 70 years ago and that was
 * published before 1929, so it is public domain in the US and the EU. Each line is our own single-voice
 * transcription of the tune; no MIDI files, arrangements or recordings were copied, and the audio is
 * synthesized by `scripts/assets/buildNotes.py`. Titles are never shown in game.
 *
 * Notation: space-separated `Note[:beats]` tokens (default 1 beat), `R` for a rest, sharps with `#`,
 * flats with `b`, octave 4 = middle C.
 */

export interface MelodyNote {
  beat: number;
  dur: number;
  midi: number;
}

export interface Melody {
  id: string;
  notes: MelodyNote[];
  /** Total length in beats, rests included. */
  beats: number;
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseMelody(id: string, src: string): Melody {
  const notes: MelodyNote[] = [];
  let beat = 0;
  for (const tok of src.trim().split(/\s+/)) {
    const [name, d] = tok.split(':');
    const dur = d ? Number(d) : 1;
    if (name !== 'R') {
      const m = /^([A-G])(#|b)?(\d)$/.exec(name);
      if (!m) throw new Error(`bad note ${tok} in ${id}`);
      const midi = 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
      notes.push({ beat, dur, midi });
    }
    beat += dur;
  }
  return { id, notes, beats: beat };
}

/** Classics in rising difficulty (odd levels 1..23 walk this list). */
export const CLASSICS: Melody[] = [
  // Twinkle Twinkle Little Star: French folk tune "Ah! vous dirai-je, maman", first printed 1761.
  parseMelody(
    'twinkle',
    'C5 C5 G5 G5 A5 A5 G5:2 F5 F5 E5 E5 D5 D5 C5:2 G5 G5 F5 F5 E5 E5 D5:2 G5 G5 F5 F5 E5 E5 D5:2 C5 C5 G5 G5 A5 A5 G5:2 F5 F5 E5 E5 D5 D5 C5:2',
  ),
  // Frere Jacques: traditional French round, 18th century.
  parseMelody(
    'jacques',
    'C5 D5 E5 C5 C5 D5 E5 C5 E5 F5 G5:2 E5 F5 G5:2 G5:.5 A5:.5 G5:.5 F5:.5 E5 C5 G5:.5 A5:.5 G5:.5 F5:.5 E5 C5 C5 G4 C5:2 C5 G4 C5:2',
  ),
  // Ode to Joy: Beethoven (d. 1827), Symphony No. 9, 1824.
  parseMelody(
    'ode',
    'E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 E5:1.5 D5:.5 D5:2 E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 D5:1.5 C5:.5 C5:2 ' +
      'D5 D5 E5 C5 D5 E5:.5 F5:.5 E5 C5 D5 E5:.5 F5:.5 E5 D5 C5 D5 G4:2 E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 D5:1.5 C5:.5 C5:2',
  ),
  // Lullaby (Wiegenlied), Op. 49 No. 4: Brahms (d. 1897), 1868.
  parseMelody(
    'brahms',
    'E5:.5 E5:.5 G5:2 E5:.5 E5:.5 G5:2 E5:.5 G5:.5 C6 B5:1.5 A5:.5 A5 G5 D5:.5 E5:.5 F5 D5 D5:.5 E5:.5 F5:2 D5:.5 F5:.5 B5:.5 A5:.5 G5 B5 C6:2',
  ),
  // Minuet in G: Christian Petzold (d. 1733), from the 1725 Anna Magdalena Bach notebook.
  parseMelody(
    'minuet',
    'D5 G4:.5 A4:.5 B4:.5 C5:.5 D5 G4 G4 E5 C5:.5 D5:.5 E5:.5 F#5:.5 G5 G4 G4 C5 D5:.5 C5:.5 B4:.5 A4:.5 B4 C5:.5 B4:.5 A4:.5 G4:.5 F#4 G4:.5 A4:.5 B4:.5 G4:.5 A4:3 ' +
      'D5 G4:.5 A4:.5 B4:.5 C5:.5 D5 G4 G4 E5 C5:.5 D5:.5 E5:.5 F#5:.5 G5 G4 G4 C5 D5:.5 C5:.5 B4:.5 A4:.5 B4 C5:.5 B4:.5 A4:.5 G4:.5 A4 B4:.5 A4:.5 G4:.5 F#4:.5 G4:3',
  ),
  // Morning Mood, Peer Gynt Suite No. 1: Grieg (d. 1907), 1875.
  parseMelody(
    'morning',
    'G5 E5:.5 D5:.5 C5:.5 D5:.5 E5 G5 E5:.5 D5:.5 C5:.5 D5:.5 E5:.5 D5:.5 E5:.5 G5:.5 E5:.5 G5:.5 A5:.5 E5:.5 A5:.5 G5:.5 E5:.5 D5:.5 C5:3',
  ),
  // Galop infernal ("Can-Can"), Orpheus in the Underworld: Offenbach (d. 1880), 1858.
  parseMelody(
    'cancan',
    'C5 C5 D5:.5 F5:.5 E5:.5 D5:.5 G5 G5 G5:.5 A5:.5 E5:.5 F5:.5 D5 D5 D5:.5 F5:.5 E5:.5 D5:.5 C5:.5 C6:.5 B5:.5 A5:.5 G5:.5 F5:.5 E5:.5 D5:.5 C5:2 R:2',
  ),
  // Eine kleine Nachtmusik, K. 525: Mozart (d. 1791), 1787.
  parseMelody(
    'nachtmusik',
    'G4 R:.5 D4:.5 G4 R:.5 D4:.5 G4:.5 D4:.5 G4:.5 B4:.5 D5 R C5 R:.5 A4:.5 C5 R:.5 A4:.5 C5:.5 A4:.5 F#4:.5 A4:.5 D4 R',
  ),
  // In the Hall of the Mountain King, Peer Gynt: Grieg (d. 1907), 1875. Transposed to A minor.
  parseMelody(
    'mountain',
    'A4:.5 B4:.5 C5:.5 D5:.5 E5:.5 C5:.5 E5 D#5:.5 B4:.5 D#5 D5:.5 A#4:.5 D5 A4:.5 B4:.5 C5:.5 D5:.5 E5:.5 C5:.5 E5:.5 A5:.5 G5:.5 E5:.5 C5:.5 E5:.5 G5:2',
  ),
  // Fur Elise, WoO 59: Beethoven (d. 1827), composed 1810, published 1867.
  parseMelody(
    'elise',
    'E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4 R:.5 C4:.5 E4:.5 A4:.5 B4 R:.5 E4:.5 G#4:.5 B4:.5 C5 R:.5 E4:.5 ' +
      'E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4 R:.5 C4:.5 E4:.5 A4:.5 B4 R:.5 E4:.5 C5:.5 B4:.5 A4:2',
  ),
  // William Tell Overture, finale: Rossini (d. 1868), 1829. Rhythm at half speed.
  parseMelody(
    'tell',
    'G4:.5 G4:.5 G4 G4:.5 G4:.5 G4 G4:.5 G4:.5 C5 D5 E5 G4:.5 G4:.5 G4 G4:.5 G4:.5 G4 G4:.5 G4:.5 C5 E5 D5 B4 G4:2 R',
  ),
  // Rondo alla Turca, Piano Sonata K. 331: Mozart (d. 1791), 1783. Rhythm at half speed.
  parseMelody(
    'turca',
    'B4:.5 A4:.5 G#4:.5 A4:.5 C5:2 D5:.5 C5:.5 B4:.5 C5:.5 E5:2 F5:.5 E5:.5 D#5:.5 E5:.5 B5:.5 A5:.5 G#5:.5 A5:.5 B5:.5 A5:.5 G#5:.5 A5:.5 C6:2',
  ),
];

/** The song for a level: classics on odd levels to L23, originals on even levels, remixed classics after. */
export function pickMelody(level: number, rng: SeededRNG, eighths: boolean, prevId?: string): Melody {
  if (level <= 23 && level % 2 === 1) {
    const i = (level - 1) / 2;
    const m = CLASSICS[i];
    if (m.id !== prevId) return m;
    return CLASSICS[i > 0 ? i - 1 : i + 1];
  }
  if (level >= 24) return rng.pick(CLASSICS.filter((m) => m.id !== prevId));
  return generateMelody(rng, { eighths, id: `gen${rng.nextInt(0, 1e9)}` });
}

/** C major pentatonic, C4..A5. */
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];

/**
 * An original melody: AABA' over 2-bar phrases with pentatonic steps, so it always sounds pleasant.
 * `eighths` allows eighth-note rhythm cells.
 */
export function generateMelody(rng: SeededRNG, opts: { eighths: boolean; id?: string }): Melody {
  const cells: number[][] = opts.eighths ? [[1], [0.5, 0.5], [1], [0.5, 0.5], [2], [1.5, 0.5]] : [[1], [1], [2], [1]];
  const phrase = (endOnTonic: boolean): { dur: number; deg: number }[] => {
    const out: { dur: number; deg: number }[] = [];
    let deg = rng.nextInt(3, 6);
    let beats = 0;
    while (beats < 8) {
      let cell = rng.pick(cells);
      if (beats + cell.reduce((a, b) => a + b, 0) > 8) cell = [8 - beats];
      for (const dur of cell) {
        out.push({ dur, deg });
        beats += dur;
        const step = rng.pick([-2, -1, -1, 1, 1, 2, 0, 3, -3]);
        deg = Math.max(0, Math.min(PENTA.length - 1, deg + step));
      }
    }
    const last = out[out.length - 1];
    last.deg = endOnTonic ? 5 : rng.pick([3, 6, 4]);
    if (last.dur < 1 && out.length > 1) {
      out[out.length - 2].dur += last.dur;
      out[out.length - 2].deg = last.deg;
      out.pop();
    }
    return out;
  };
  const a = phrase(false);
  const b = phrase(false);
  const a2 = a.map((n) => ({ ...n }));
  const tail = phrase(true).slice(-2);
  const keep = a2.reduce((s, n) => s + n.dur, 0) - tail.reduce((s, n) => s + n.dur, 0);
  const aEnd: { dur: number; deg: number }[] = [];
  let acc = 0;
  for (const n of a2) {
    if (acc + n.dur > keep) break;
    aEnd.push(n);
    acc += n.dur;
  }
  if (acc < keep) aEnd.push({ dur: keep - acc, deg: a2[aEnd.length]?.deg ?? 5 });
  const seq = [...a, ...a, ...b, ...aEnd, ...tail];
  const notes: MelodyNote[] = [];
  let beat = 0;
  for (const n of seq) {
    notes.push({ beat, dur: n.dur, midi: PENTA[n.deg] });
    beat += n.dur;
  }
  return { id: opts.id ?? 'gen', notes, beats: beat };
}
