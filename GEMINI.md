# Zikaron3D - Architecture Rules (v2: animated arcade platform)

Plan lives in `ZIKARON3D_BLUEPRINT.md` (single plan file). Do not create other planning docs.

1. STACK
 - Expo SDK 58 + React Native + TypeScript, run locally with `npx expo run:ios` (Metro on `localhost`).
 - Renderer: `@shopify/react-native-skia` + `react-native-reanimated` (UI-thread sim). No three.js / R3F / expo-gl.
 - Characters: PixVerse clips -> chroma-keyed sprite atlases (`scripts/assets/buildSprites.py`). Worlds: still image + shader motion (no video backgrounds).
 - Audio `expo-audio`, haptics `expo-haptics`, state `zustand` + MMKV, gestures `react-native-gesture-handler`.

2. DESIGN
 - No cards. No text/letters/numbers in gameplay. Everything animated, reactive, juicy.
 - Modes: `TOYBOX` (kids), `ARCADE` (gamers), `SANCTUARY` (seniors/zen).
 - Premium stylized toy look (Astro Bot / Nintendo first-party). Follow the art bible in the blueprint.

3. FOLDERS
 - `src/render` (sprites, particles, shaders), `src/fx` (sound, juice), `src/scenes`, `src/games/<id>`, `src/engine` (RNG, DDA, loop), `src/ui`, `src/store`.
 - `scripts/assets` PixVerse generation + sprite/SFX build. Raw media in `assets/raw`, shipped media in `assets/sprites|worlds|audio`.
 - `archive/v1-cards` is dead code; never import from it (reuse by copying).

4. RULES
 - React Compiler lint: use `sv.set()/get()` not `sv.value =` outside worklets.
 - Verify Expo APIs against docs for the installed SDK before use.
