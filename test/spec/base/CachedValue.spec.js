import { expect } from 'chai';

import sinon from 'sinon';

import CachedValue, { MAX_POSTPONE } from 'lib/base/util/CachedValue';


describe('CachedValue', function() {

  describe('immediate', function() {

    it('should compute on first access', async function() {

      // given
      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator);

      // when
      const promise = cachedValue.get();

      // then
      expect(generator).to.have.been.calledOnce;
      expect(await promise).to.eql('foo');
    });


    it('should cache value', async function() {

      // given
      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator);

      // when
      await cachedValue.get();
      await cachedValue.get();

      // then
      expect(generator).to.have.been.calledOnce;
    });


    it('should recompute after invalidation', async function() {

      // given
      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator);

      await cachedValue.get();

      // when
      cachedValue.invalidate();
      await cachedValue.get();

      // then
      expect(generator).to.have.been.calledTwice;
    });


    it('should resolve with latest value if invalidated while computing', async function() {

      // given
      let state = 'outdated';

      const generator = sinon.spy(async () => {
        const value = state;

        await tick();

        return value;
      });

      const cachedValue = new CachedValue(generator);

      // when
      const promise = cachedValue.get();

      state = 'latest';
      cachedValue.invalidate();

      // then
      expect(await promise).to.eql('latest');
      expect(generator).to.have.been.calledTwice;
    });


    it('should share computation if accessed after invalidation', async function() {

      // given
      let state = 'outdated';

      const generator = sinon.spy(async () => {
        const value = state;

        await tick();

        return value;
      });

      const cachedValue = new CachedValue(generator);

      // when
      const outdatedPromise = cachedValue.get();

      state = 'latest';
      cachedValue.invalidate();

      const latestPromise = cachedValue.get();

      // then
      expect(latestPromise).to.equal(outdatedPromise);
      expect(await latestPromise).to.eql('latest');
      expect(generator).to.have.been.calledTwice;
    });


    it('should start over once', async function() {

      // given
      const generator = createGenerator();
      const cachedValue = new CachedValue(generator);

      const promise = cachedValue.get();

      cachedValue.invalidate();

      generator.resolve(0, 'outdated');

      await tick();

      // assume
      expect(generator).to.have.been.calledTwice;

      // when
      cachedValue.invalidate();

      generator.resolve(1, 'computed');

      // then
      expect(await promise).to.eql('computed');
      expect(generator).to.have.been.calledTwice;

      // computes on next access
      const nextPromise = cachedValue.get();

      expect(nextPromise).not.to.equal(promise);
      expect(generator).to.have.been.calledThrice;
    });


    it('should settle with computed value if invalidated twice', async function() {

      // given
      const generator = createGenerator();
      const cachedValue = new CachedValue(generator);

      const promise = cachedValue.get();

      // when
      cachedValue.invalidate();
      cachedValue.invalidate();

      generator.resolve(0, 'computed');

      // then
      expect(await promise).to.eql('computed');
      expect(generator).to.have.been.calledOnce;

      // computes on next access
      const nextPromise = cachedValue.get();

      expect(nextPromise).not.to.equal(promise);
      expect(generator).to.have.been.calledTwice;
    });


    it('should settle if computation invalidates synchronously', async function() {

      // given
      const generator = sinon.spy(() => {
        cachedValue.invalidate();

        return generator.callCount;
      });

      const cachedValue = new CachedValue(generator);

      // when
      const value = await cachedValue.get();

      // then
      expect(value).to.eql(2);
      expect(generator).to.have.been.calledTwice;
    });


    it('should settle if computation keeps invalidating', async function() {

      // given
      const generator = sinon.spy(async () => {
        await tick();

        cachedValue.invalidate();

        return generator.callCount;
      });

      const cachedValue = new CachedValue(generator);

      // when
      const value = await cachedValue.get();

      // then
      expect(value).to.eql(2);
      expect(generator).to.have.been.calledTwice;
    });


    it('should reject with error of current computation', async function() {

      // given
      const cachedValue = new CachedValue(async () => {
        throw new Error('failed');
      });

      // when
      const error = await cachedValue.get().catch(error => error);

      // then
      expect(error).to.be.an('error');
      expect(error.message).to.eql('failed');
    });


    it('should reject with error thrown synchronously', async function() {

      // given
      const cachedValue = new CachedValue(() => {
        throw new Error('failed');
      });

      // when
      const error = await cachedValue.get().catch(error => error);

      // then
      expect(error).to.be.an('error');
      expect(error.message).to.eql('failed');
    });


    it('should ignore error of outdated computation', async function() {

      // given
      let fail = true;

      const cachedValue = new CachedValue(async () => {
        const shouldFail = fail;

        await tick();

        if (shouldFail) {
          throw new Error('failed');
        }

        return 'foo';
      });

      // when
      const promise = cachedValue.get();

      fail = false;
      cachedValue.invalidate();

      // then
      expect(await promise).to.eql('foo');
    });

  });


  describe('deferred', function() {

    let clock, scheduler;

    beforeEach(function() {
      scheduler = createScheduler();
    });

    afterEach(function() {
      if (clock) {
        clock.restore();
        clock = null;
      }
    });


    it('should not compute before start', async function() {

      // given
      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

      // when
      cachedValue.get();

      await tick();

      // then
      expect(generator).not.to.have.been.called;
      expect(scheduler.pending()).to.eql(1);
    });


    it('should compute on start', async function() {

      // given
      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

      const promise = cachedValue.get();

      // when
      scheduler.run();

      // then
      expect(await promise).to.eql('foo');
      expect(generator).to.have.been.calledOnce;
    });


    it('should coalesce invalidations before start', async function() {

      // given
      let state = 0;

      const generator = sinon.spy(() => state);
      const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

      // when
      const promises = [];

      for (let i = 0; i < 10; i++) {
        state++;
        cachedValue.invalidate();
        promises.push(cachedValue.get());
      }

      scheduler.run();

      // then
      expect(await Promise.all(promises)).to.eql(new Array(10).fill(10));
      expect(generator).to.have.been.calledOnce;
      expect(scheduler.pending()).to.eql(0);
    });


    it('should postpone start on invalidation', async function() {

      // given
      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

      const promise = cachedValue.get();

      const [ start ] = scheduler.callbacks();

      // when
      cachedValue.invalidate();

      // then
      expect(scheduler.canceled()).to.eql(1);
      expect(scheduler.pending()).to.eql(1);

      // canceled start does not compute
      start();

      expect(generator).not.to.have.been.called;

      scheduler.run();

      expect(await promise).to.eql('foo');
      expect(generator).to.have.been.calledOnce;
    });


    it('should not postpone start for longer than MAX_POSTPONE', function() {

      // given
      clock = sinon.useFakeTimers({ toFake: [ 'Date' ] });

      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

      cachedValue.get();

      cachedValue.invalidate();

      // assume
      expect(scheduler.scheduled()).to.eql(2);

      // when
      clock.tick(MAX_POSTPONE);

      cachedValue.invalidate();

      // then
      expect(scheduler.scheduled()).to.eql(2);
      expect(scheduler.pending()).to.eql(1);
    });


    it('should schedule lost start again', function() {

      // given
      clock = sinon.useFakeTimers({ toFake: [ 'Date' ] });

      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

      cachedValue.get();

      // when
      clock.tick(MAX_POSTPONE * 2);

      cachedValue.invalidate();

      // then
      expect(scheduler.scheduled()).to.eql(2);
      expect(scheduler.pending()).to.eql(1);

      // and postpones again
      cachedValue.invalidate();

      expect(scheduler.scheduled()).to.eql(3);
    });


    it('should start over deferred if invalidated while computing', async function() {

      // given
      const generator = createGenerator();
      const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

      const promise = cachedValue.get();

      scheduler.run();

      // assume
      expect(generator).to.have.been.calledOnce;

      // when
      cachedValue.invalidate();

      generator.resolve(0, 'outdated');

      await tick();

      // then
      expect(cachedValue.get()).to.equal(promise);
      expect(generator).to.have.been.calledOnce;
      expect(scheduler.pending()).to.eql(1);

      scheduler.run();

      generator.resolve(1, 'latest');

      expect(await promise).to.eql('latest');
      expect(generator).to.have.been.calledTwice;
    });


    it('should start once', async function() {

      // given
      let start;

      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator, {
        defer(callback) {
          start = callback;

          return () => {};
        }
      });

      const promise = cachedValue.get();

      // when
      start();
      start();

      // then
      expect(await promise).to.eql('foo');
      expect(generator).to.have.been.calledOnce;
    });


    it('should start synchronously', async function() {

      // given
      const generator = sinon.stub().resolves('foo');
      const cachedValue = new CachedValue(generator, {
        defer(callback) {
          callback();

          return () => {};
        }
      });

      // when
      const promise = cachedValue.get();

      // then
      expect(await promise).to.eql('foo');
      expect(generator).to.have.been.calledOnce;

      cachedValue.invalidate();

      await cachedValue.get();

      expect(generator).to.have.been.calledTwice;
    });


    it('should settle if computation started synchronously invalidates', async function() {

      // given
      const generator = sinon.spy(() => {
        cachedValue.invalidate();

        return generator.callCount;
      });

      const cachedValue = new CachedValue(generator, {
        defer(callback) {
          callback();

          return () => {};
        }
      });

      // when
      const value = await cachedValue.get();

      // then
      expect(value).to.eql(2);
      expect(generator).to.have.been.calledTwice;
    });


    it('should reject with error of computation', async function() {

      // given
      let fail = true;

      const cachedValue = new CachedValue(async () => {
        if (fail) {
          throw new Error('failed');
        }

        return 'foo';
      }, { defer: scheduler.defer });

      const promise = cachedValue.get();

      // when
      scheduler.run();

      const error = await promise.catch(error => error);

      // then
      expect(error).to.be.an('error');
      expect(error.message).to.eql('failed');

      // but when
      fail = false;

      cachedValue.invalidate();

      const nextPromise = cachedValue.get();

      scheduler.run();

      // then
      expect(await nextPromise).to.eql('foo');
    });


    describe('#dispose', function() {

      it('should resolve pending computation with given value', async function() {

        // given
        const generator = sinon.stub().resolves('foo');
        const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

        const promise = cachedValue.get();

        // when
        cachedValue.dispose('disposed');

        // then
        expect(await promise).to.eql('disposed');
        expect(generator).not.to.have.been.called;
        expect(scheduler.pending()).to.eql(0);
      });


      it('should not start pending computation', async function() {

        // given
        let start;

        const generator = sinon.stub().resolves('foo');
        const cachedValue = new CachedValue(generator, {
          defer(callback) {
            start = callback;

            return () => {};
          }
        });

        const promise = cachedValue.get();

        // when
        cachedValue.dispose('disposed');

        start();

        // then
        expect(await promise).to.eql('disposed');
        expect(generator).not.to.have.been.called;
      });


      it('should not start over running computation', async function() {

        // given
        const generator = createGenerator();
        const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

        const promise = cachedValue.get();

        scheduler.run();

        cachedValue.invalidate();

        // when
        cachedValue.dispose('disposed');

        generator.resolve(0, 'computed');

        // then
        expect(await promise).to.eql('computed');
        expect(generator).to.have.been.calledOnce;
        expect(scheduler.pending()).to.eql(0);
      });


      it('should compute immediately afterwards', async function() {

        // given
        const generator = sinon.stub().resolves('foo');
        const cachedValue = new CachedValue(generator, { defer: scheduler.defer });

        // when
        cachedValue.dispose();

        const promise = cachedValue.get();

        // then
        expect(generator).to.have.been.calledOnce;
        expect(await promise).to.eql('foo');
        expect(scheduler.scheduled()).to.eql(0);
      });

    });

  });

});


// helpers //////////////////////

function tick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * A generator returning promises resolved on demand.
 */
function createGenerator() {
  const deferreds = [];

  const generator = sinon.spy(() => {
    return new Promise(resolve => {
      deferreds.push(resolve);
    });
  });

  generator.resolve = (index, value) => deferreds[index](value);

  return generator;
}

/**
 * A scheduler starting deferred computations on demand.
 */
function createScheduler() {
  const callbacks = [];

  let pending = [];
  let canceled = 0;

  return {
    defer(callback) {
      callbacks.push(callback);
      pending.push(callback);

      return () => {
        canceled++;

        pending = pending.filter(fn => fn !== callback);
      };
    },
    run() {
      const callbacks = pending;

      pending = [];

      callbacks.forEach(callback => callback());
    },
    callbacks() {
      return callbacks;
    },
    pending() {
      return pending.length;
    },
    scheduled() {
      return callbacks.length;
    },
    canceled() {
      return canceled;
    }
  };
}
