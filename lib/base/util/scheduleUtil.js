/**
 * Maximum time to wait for an animation frame. Browsers do not produce
 * frames for hidden documents.
 */
export const FRAME_TIMEOUT = 1000;

/**
 * Schedule a callback to run once the browser had a chance to paint, i.e. in
 * a task after the next animation frame. Animation frame callbacks run before
 * painting and a timeout alone may run before rendering.
 *
 * Falls back to a timeout where animation frames are not available (Node,
 * workers) or not produced within `FRAME_TIMEOUT` (hidden documents).
 *
 * @param {Function} callback
 *
 * @return {Function} function to cancel the callback
 */
export function afterPaint(callback) {
  let done = false,
      frame,
      fallback,
      timeout;

  function cancel() {
    done = true;

    if (frame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frame);
    }

    frame = null;

    clearTimeout(fallback);
    clearTimeout(timeout);
  }

  function run() {
    if (done) {
      return;
    }

    cancel();

    callback();
  }

  if (typeof requestAnimationFrame !== 'function') {
    timeout = setTimeout(run, 0);

    return cancel;
  }

  frame = requestAnimationFrame(() => {
    frame = null;

    if (done) {
      return;
    }

    clearTimeout(fallback);

    timeout = setTimeout(run, 0);
  });

  fallback = setTimeout(run, FRAME_TIMEOUT);

  return cancel;
}
