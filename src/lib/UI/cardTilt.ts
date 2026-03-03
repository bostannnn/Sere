interface TiltState {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  currentGlareX: number;
  currentGlareY: number;
  targetGlareX: number;
  targetGlareY: number;
  baseLeft: number;
  baseTop: number;
  baseWidth: number;
  baseHeight: number;
  hasBounds: boolean;
  rafId: number | null;
}

interface CardTiltControllerOptions {
  hostSelector: string;
  tiltVarX: string;
  tiltVarY: string;
  glareVarX: string;
  glareVarY: string;
  glareOpacityVar: string;
  getReducedMotion: () => boolean;
  maxTilt?: number;
  glareOpacityOnMove?: string;
}

export interface CardTiltController {
  onPointerMove: (event: PointerEvent) => void;
  onPointerLeave: (event: PointerEvent) => void;
  resetFromTarget: (target: EventTarget | null) => void;
}

export function createCardTiltController(options: CardTiltControllerOptions): CardTiltController {
  const tiltStateByCard = new WeakMap<HTMLElement, TiltState>();
  const maxTilt = options.maxTilt ?? 9;
  const glareOpacityOnMove = options.glareOpacityOnMove ?? "0.58";

  function getHostFromTarget(target: EventTarget | null): HTMLElement | null {
    return (target as HTMLElement | null)?.closest(options.hostSelector) as HTMLElement | null;
  }

  function getTiltState(host: HTMLElement): TiltState {
    let state = tiltStateByCard.get(host);
    if (!state) {
      state = {
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
        currentGlareX: 50,
        currentGlareY: 50,
        targetGlareX: 50,
        targetGlareY: 50,
        baseLeft: 0,
        baseTop: 0,
        baseWidth: 0,
        baseHeight: 0,
        hasBounds: false,
        rafId: null,
      };
      tiltStateByCard.set(host, state);
    }
    return state;
  }

  function runTiltAnimation(host: HTMLElement) {
    const state = getTiltState(host);
    if (state.rafId !== null) {
      return;
    }

    const step = () => {
      if (!host.isConnected) {
        if (state.rafId !== null) {
          cancelAnimationFrame(state.rafId);
        }
        state.rafId = null;
        tiltStateByCard.delete(host);
        return;
      }

      const tiltLerp = 0.2;
      const glareLerp = 0.26;

      state.currentX += (state.targetX - state.currentX) * tiltLerp;
      state.currentY += (state.targetY - state.currentY) * tiltLerp;
      state.currentGlareX += (state.targetGlareX - state.currentGlareX) * glareLerp;
      state.currentGlareY += (state.targetGlareY - state.currentGlareY) * glareLerp;

      host.style.setProperty(options.tiltVarX, `${state.currentX.toFixed(2)}deg`);
      host.style.setProperty(options.tiltVarY, `${state.currentY.toFixed(2)}deg`);
      host.style.setProperty(options.glareVarX, `${state.currentGlareX.toFixed(2)}%`);
      host.style.setProperty(options.glareVarY, `${state.currentGlareY.toFixed(2)}%`);

      const tiltSettled = Math.abs(state.targetX - state.currentX) < 0.05
        && Math.abs(state.targetY - state.currentY) < 0.05;
      const glareSettled = Math.abs(state.targetGlareX - state.currentGlareX) < 0.1
        && Math.abs(state.targetGlareY - state.currentGlareY) < 0.1;

      if (tiltSettled && glareSettled) {
        state.currentX = state.targetX;
        state.currentY = state.targetY;
        state.currentGlareX = state.targetGlareX;
        state.currentGlareY = state.targetGlareY;
        state.rafId = null;
        return;
      }

      state.rafId = requestAnimationFrame(step);
    };

    state.rafId = requestAnimationFrame(step);
  }

  function onPointerMove(event: PointerEvent) {
    const area = event.currentTarget as HTMLElement | null;
    const host = getHostFromTarget(event.currentTarget);
    if (!host || !area || event.pointerType !== "mouse") {
      return;
    }
    if (options.getReducedMotion()) {
      return;
    }

    const state = getTiltState(host);
    if (!state.hasBounds) {
      const rect = area.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      state.baseLeft = rect.left;
      state.baseTop = rect.top;
      state.baseWidth = rect.width;
      state.baseHeight = rect.height;
      state.hasBounds = true;
    }

    const normalizedX = Math.max(0, Math.min(1, (event.clientX - state.baseLeft) / state.baseWidth));
    const normalizedY = Math.max(0, Math.min(1, (event.clientY - state.baseTop) / state.baseHeight));
    const offsetX = normalizedX * 2 - 1;
    const offsetY = normalizedY * 2 - 1;

    state.targetX = -offsetY * maxTilt;
    state.targetY = offsetX * maxTilt;
    state.targetGlareX = normalizedX * 100;
    state.targetGlareY = normalizedY * 100;

    host.style.setProperty(options.glareOpacityVar, glareOpacityOnMove);
    runTiltAnimation(host);
  }

  function resetFromTarget(target: EventTarget | null) {
    const host = getHostFromTarget(target);
    if (!host) {
      return;
    }
    const state = getTiltState(host);
    if (options.getReducedMotion()) {
      if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      state.currentX = 0;
      state.currentY = 0;
      state.targetX = 0;
      state.targetY = 0;
      state.currentGlareX = 50;
      state.currentGlareY = 50;
      state.targetGlareX = 50;
      state.targetGlareY = 50;
      state.hasBounds = false;
      host.style.setProperty(options.tiltVarX, "0deg");
      host.style.setProperty(options.tiltVarY, "0deg");
      host.style.setProperty(options.glareVarX, "50%");
      host.style.setProperty(options.glareVarY, "50%");
      host.style.setProperty(options.glareOpacityVar, "0");
      return;
    }
    state.targetX = 0;
    state.targetY = 0;
    state.targetGlareX = 50;
    state.targetGlareY = 50;
    state.hasBounds = false;
    host.style.setProperty(options.glareOpacityVar, "0");
    runTiltAnimation(host);
  }

  function onPointerLeave(event: PointerEvent) {
    resetFromTarget(event.currentTarget);
  }

  return {
    onPointerMove,
    onPointerLeave,
    resetFromTarget,
  };
}
