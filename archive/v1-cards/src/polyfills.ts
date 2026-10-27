/**
 * Zikaron3D Runtime Polyfills
 * Must be executed before any third-party libraries (especially Three.js) are evaluated.
 */

// 1. Process polyfill: Hermes has an incomplete process object missing emitWarning.
// three.js CJS wrapper calls process.emitWarning on import.
if (typeof process === 'undefined') {
  (globalThis as any).process = {
    env: { NODE_ENV: __DEV__ ? 'development' : 'production' },
    emitWarning: (warning: any) => {
      if (__DEV__) {
        console.warn('[process.emitWarning]', typeof warning === 'string' ? warning : warning?.message ?? warning);
      }
    },
  };
} else if (typeof (process as any).emitWarning !== 'function') {
  (process as any).emitWarning = (warning: any) => {
    if (__DEV__) {
      console.warn('[process.emitWarning]', typeof warning === 'string' ? warning : warning?.message ?? warning);
    }
  };
}

// 2. WebGL 1 vs WebGL 2 compatibility with Three.js r163+:
// expo-gl implements WebGL2 by having WebGL2RenderingContext extend WebGLRenderingContext.
// Three.js r163+ checks `if (context instanceof WebGLRenderingContext) throw Error("WebGL 1 is not supported since r163")`.
// In standard browsers, WebGL2RenderingContext does NOT inherit from WebGLRenderingContext.
// We intercept WebGLRenderingContext so that `context instanceof WebGLRenderingContext` returns false.
function patchWebGLRenderingContext(Ctor: any) {
  if (!Ctor || Ctor.__patchedHasInstance) return;
  try {
    Object.defineProperty(Ctor, Symbol.hasInstance, {
      value: (instance: any) => {
        // In expo-gl, all contexts are WebGL2-capable.
        // Return false so Three.js r163+ does not misidentify expo-gl as WebGL 1.
        return false;
      },
      configurable: true,
    });
    Ctor.__patchedHasInstance = true;
  } catch (e) {
    console.warn('[polyfills] Failed to patch WebGLRenderingContext', e);
  }
}

let _WebGLRenderingContext = (globalThis as any).WebGLRenderingContext;
if (_WebGLRenderingContext) {
  patchWebGLRenderingContext(_WebGLRenderingContext);
}
Object.defineProperty(globalThis, 'WebGLRenderingContext', {
  get: () => _WebGLRenderingContext,
  set: (val) => {
    _WebGLRenderingContext = val;
    patchWebGLRenderingContext(val);
  },
  configurable: true,
  enumerable: true,
});
