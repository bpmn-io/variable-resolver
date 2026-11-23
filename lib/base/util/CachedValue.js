/**
 * Maximum time to postpone the start of a deferred computation.
 */
export const MAX_POSTPONE = 1000;

/**
 * A lazily computed value, cached until invalidated.
 *
 * Requests share the pending computation, so they settle in request order.
 *
 * With `options.defer`, a computation starts once the deferred callback
 * runs. An invalidation until then defers the start again, so that it
 * follows the latest change, for at most `MAX_POSTPONE` milliseconds.
 *
 * A computation invalidated while it runs starts over once, keeping its
 * promise. If invalidated again, it settles with what it computed, and the
 * next request starts a new computation. This bounds the work for values
 * that keep changing while being computed, e.g. by the computation itself.
 */
export default class CachedValue {

  /**
   * @param {Function} generatorFunction
   * @param {Object} [options]
   * @param {Function} [options.defer] schedules the start of a computation,
   *   `(start: Function) => (cancel: Function)`
   */
  constructor(generatorFunction, options = {}) {
    this._generate = generatorFunction;
    this._defer = options.defer;

    this.value = null;
    this.valid = false;

    this._pending = null;
  }

  invalidate() {
    const pending = this._pending;

    if (pending && pending.scheduled) {
      return this._postpone(pending);
    }

    if (pending && !pending.outdated && !pending.restarted) {
      pending.outdated = true;

      return;
    }

    // a running computation settles with what it computes
    this._pending = null;
    this.valid = false;
  }

  get() {
    if (!this.valid) {
      const pending = this._pending = {};

      this.valid = true;
      this.value = new Promise((resolve, reject) => {
        pending.resolve = resolve;
        pending.reject = reject;
      });

      this._start(pending);
    }

    return this.value;
  }

  /**
   * Stop deferring computations. A computation that did not start yet
   * resolves with the given value instead of computing. A running one does
   * not start over.
   *
   * @param {*} [value]
   */
  dispose(value) {
    const pending = this._pending;

    this._defer = null;
    this._pending = null;

    if (pending && pending.scheduled) {
      pending.scheduled = false;
      pending.cancel();
      pending.resolve(value);
    }
  }

  _start(pending) {
    if (!this._defer) {
      return this._compute(pending);
    }

    pending.deferredAt = Date.now();

    this._schedule(pending);
  }

  _schedule(pending) {
    const start = () => {
      if (pending.start === start && pending.scheduled) {
        pending.scheduled = false;

        this._compute(pending);
      }
    };

    pending.start = start;
    pending.scheduled = true;
    pending.cancel = this._defer(start);
  }

  _postpone(pending) {
    const now = Date.now();
    const elapsed = now - pending.deferredAt;

    // overdue for long, the start got lost (e.g. to fake timers)
    if (elapsed >= MAX_POSTPONE * 2) {
      pending.deferredAt = now;
    } else if (elapsed >= MAX_POSTPONE) {
      return;
    }

    pending.cancel();

    this._schedule(pending);
  }

  async _compute(pending) {
    let value, error, failed = false;

    try {
      value = await this._generate();
    } catch (err) {
      error = err;
      failed = true;
    }

    // invalidated while computing, start over once
    if (pending.outdated && this._pending === pending) {
      pending.outdated = false;
      pending.restarted = true;

      return this._start(pending);
    }

    if (this._pending === pending) {
      this._pending = null;
    }

    if (failed) {
      pending.reject(error);
    } else {
      pending.resolve(value);
    }
  }
}
