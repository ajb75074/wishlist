import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { parseGIF, decompressFrames } from "gifuct-js";
import clothingGifUrl from "../../assets/clothing.gif";
import "./ClothingRackAnimation.css";

// No idle loop anymore - the animation sits paused until the user is
// actively typing, then pauses again shortly after they stop. This is
// a deliberate reversal of an earlier version of this component, which
// always kept a slow ambient loop running.
const IDLE_TIMEOUT_MS = 850;
const TYPING_WINDOW_MS = 1000;
const MIN_INTERVAL_MS = 35;
// Snappier than a pure "typing speed" reading (below) would need on
// its own - the point is to erase any sense of one-frame-per-keystroke
// stepping, not just track velocity precisely.
const EASING_FACTOR = 0.22;
// completeToEnd()'s "finish the loop" catch-up - capped so finishing
// from anywhere in a 160-frame sequence still feels quick, never a
// multi-second wait after pressing Enter.
const CATCHUP_MAX_DURATION_MS = 500;
const CATCHUP_MIN_FRAME_MS = 16;

// Recent-keystroke count (within TYPING_WINDOW_MS) -> target ms/frame.
// Fast enough at every bucket that several frames play between
// consecutive keystrokes (a normal ~150-250ms typing cadence), not
// roughly one frame per key - that's what actually reads as smooth,
// continuous motion instead of a mechanical per-keystroke step.
function targetIntervalForKeystrokeCount(count) {
  if (count >= 8) return 45;
  if (count >= 5) return 65;
  if (count >= 2) return 90;
  return 140;
}

// gifuct-js only decodes each frame's own raw PATCH (the changed
// region, per that frame's disposal method) - this composites every
// frame into a full, independently-drawable ImageData ONCE up front,
// respecting disposalType exactly as the GIF spec requires (2 = clear
// the previous frame's region back out before the next one draws, 3 =
// restore what was there before the previous frame drew). After this,
// playback is just "put this frame's full pixel data on the canvas" -
// the same random-access-by-index model a plain frame-image sequence
// would give, which is what makes pause/resume/scrub/loop all trivial.
function compositeFrames(frames, width, height) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d");

  const patchCanvas = document.createElement("canvas");
  const patchCtx = patchCanvas.getContext("2d");

  let savedImageData = null;
  const composited = [];

  frames.forEach((frame, index) => {
    const previous = frames[index - 1];
    if (previous) {
      if (previous.disposalType === 2) {
        tempCtx.clearRect(previous.dims.left, previous.dims.top, previous.dims.width, previous.dims.height);
      } else if (previous.disposalType === 3 && savedImageData) {
        tempCtx.putImageData(savedImageData, 0, 0);
      }
    }

    if (frame.disposalType === 3) {
      savedImageData = tempCtx.getImageData(0, 0, width, height);
    }

    patchCanvas.width = frame.dims.width;
    patchCanvas.height = frame.dims.height;
    patchCtx.putImageData(new ImageData(frame.patch, frame.dims.width, frame.dims.height), 0, 0);

    tempCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

    composited.push(tempCtx.getImageData(0, 0, width, height));
  });

  return composited;
}

// Isolated on purpose (see AuthShell.jsx's own comment) - all frame/
// playback state lives in refs and a <canvas>, updated via
// requestAnimationFrame, so a keystroke in the form next to it never
// re-renders SignInScreen/ForgotPasswordScreen. The parent talks to
// this component through the imperative handle below (reportKeystroke,
// completeToEnd), never through props/state, for exactly that reason.
const ClothingRackAnimation = forwardRef(function ClothingRackAnimation(_props, ref) {
  const canvasRef = useRef(null);
  const framesRef = useRef([]);
  const frameIndexRef = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  const keystrokeTimestampsRef = useRef([]);
  const lastKeystrokeAtRef = useRef(0);
  const currentIntervalRef = useRef(500);
  const accumulatorRef = useRef(0);
  // Non-null while the submit-triggered "finish the loop" catch-up is
  // running - takes priority over normal typing-driven playback in the
  // tick loop below until it completes. In practice nothing else can
  // interrupt it anyway: the form disables its fields during submit,
  // so reportKeystroke can't fire again until a fresh attempt.
  const catchUpRef = useRef(null);

  function drawFrame(index) {
    const frames = framesRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!frames.length || !ctx) return;
    ctx.putImageData(frames[index], 0, 0);
  }

  useImperativeHandle(
    ref,
    () => ({
      // Called directly from the form's own onChange handlers (input
      // events - typing and backspace/delete both fire one; Shift/
      // Ctrl/Tab/arrow keys etc. never do) - never from raw keydown, so
      // only real text-editing activity ever affects playback.
      reportKeystroke() {
        const now = performance.now();
        keystrokeTimestampsRef.current.push(now);
        lastKeystrokeAtRef.current = now;
      },
      // Called once, right as the form submits - guarantees the loop
      // always reaches its final frame by the time Enter/Sign in is
      // pressed, regardless of how far through it typing had gotten.
      // A no-op if it's already there, or under reduced motion.
      completeToEnd() {
        if (prefersReducedMotion) return;

        const frameCount = framesRef.current.length;
        if (!frameCount) return;

        const lastIndex = frameCount - 1;
        const framesRemaining = (lastIndex - frameIndexRef.current + frameCount) % frameCount;
        if (framesRemaining === 0) return;

        const msPerFrame = Math.max(
          CATCHUP_MIN_FRAME_MS,
          Math.min(currentIntervalRef.current, CATCHUP_MAX_DURATION_MS / framesRemaining),
        );

        catchUpRef.current = { framesRemaining, msPerFrame, accumulator: 0 };
      },
    }),
    [prefersReducedMotion],
  );

  useEffect(() => {
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mql) return;

    function handleChange(event) {
      setPrefersReducedMotion(event.matches);
    }

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // Fetch + decode + composite ALL frames exactly once, then keep them
  // in framesRef for the lifetime of this mount - playback afterward
  // never re-fetches or re-decodes anything.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(clothingGifUrl);
      const buffer = await response.arrayBuffer();
      if (cancelled) return;

      const gif = parseGIF(buffer);
      const rawFrames = decompressFrames(gif, true);
      const { width, height } = gif.lsd;

      const composited = compositeFrames(rawFrames, width, height);
      if (cancelled) return;

      framesRef.current = composited;
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
      drawFrame(0);
      setIsReady(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady || prefersReducedMotion) return;

    let rafId;
    let lastTimestamp = performance.now();

    function tick(timestamp) {
      const deltaMs = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      if (catchUpRef.current) {
        const state = catchUpRef.current;
        state.accumulator += deltaMs;
        while (state.accumulator >= state.msPerFrame && state.framesRemaining > 0) {
          state.accumulator -= state.msPerFrame;
          frameIndexRef.current = (frameIndexRef.current + 1) % framesRef.current.length;
          state.framesRemaining -= 1;
          drawFrame(frameIndexRef.current);
        }
        if (state.framesRemaining <= 0) {
          catchUpRef.current = null;
        }
        rafId = requestAnimationFrame(tick);
        return;
      }

      const cutoff = timestamp - TYPING_WINDOW_MS;
      keystrokeTimestampsRef.current = keystrokeTimestampsRef.current.filter((t) => t >= cutoff);

      const isTypingActive = timestamp - lastKeystrokeAtRef.current < IDLE_TIMEOUT_MS;

      if (!isTypingActive) {
        // Paused, not slowed - no frame advance at all. Reset the
        // accumulator so resuming later doesn't immediately fire off a
        // frame from leftover buildup.
        accumulatorRef.current = 0;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const targetInterval = Math.max(
        MIN_INTERVAL_MS,
        targetIntervalForKeystrokeCount(keystrokeTimestampsRef.current.length),
      );
      // Eased, not snapped - typing faster/slower smoothly speeds up or
      // slows down the loop rather than jumping between fixed speeds.
      currentIntervalRef.current += (targetInterval - currentIntervalRef.current) * EASING_FACTOR;

      accumulatorRef.current += deltaMs;
      if (accumulatorRef.current >= currentIntervalRef.current) {
        accumulatorRef.current = 0;
        frameIndexRef.current = (frameIndexRef.current + 1) % framesRef.current.length;
        drawFrame(frameIndexRef.current);
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isReady, prefersReducedMotion]);

  return (
    <div className="clothing-rack-animation">
      <canvas ref={canvasRef} className="clothing-rack-animation__frame" />
    </div>
  );
});

export default ClothingRackAnimation;
