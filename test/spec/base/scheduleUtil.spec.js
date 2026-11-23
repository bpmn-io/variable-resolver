import { expect } from 'chai';

import sinon from 'sinon';

import {
  afterPaint,
  FRAME_TIMEOUT
} from 'lib/base/util/scheduleUtil';


describe('scheduleUtil', function() {

  describe('#afterPaint', function() {

    let clock;

    afterEach(function() {
      if (clock) {
        clock.restore();
        clock = null;
      }

      sinon.restore();
    });


    it('should run after next animation frame', async function() {

      // given
      const calls = [];

      // when
      afterPaint(() => calls.push('afterPaint'));

      requestAnimationFrame(() => calls.push('frame'));

      await new Promise(resolve => afterPaint(resolve));

      // then
      expect(calls).to.eql([ 'frame', 'afterPaint' ]);
    });


    it('should not run within current task', async function() {

      // given
      const callback = sinon.spy();

      // when
      afterPaint(callback);

      await Promise.resolve();

      // then
      expect(callback).not.to.have.been.called;
    });


    it('should cancel', async function() {

      // given
      const callback = sinon.spy();

      // when
      const cancel = afterPaint(callback);

      cancel();

      await new Promise(resolve => afterPaint(resolve));
      await new Promise(resolve => setTimeout(resolve, 10));

      // then
      expect(callback).not.to.have.been.called;
    });


    it('should run once', function() {

      // given
      clock = sinon.useFakeTimers({
        toFake: [
          'setTimeout',
          'clearTimeout',
          'requestAnimationFrame',
          'cancelAnimationFrame'
        ]
      });

      const callback = sinon.spy();

      // when
      afterPaint(callback);

      clock.tick(FRAME_TIMEOUT * 2);

      // then
      expect(callback).to.have.been.calledOnce;
    });


    it('should run once if timeouts cannot be cleared', async function() {

      // given
      clock = sinon.useFakeTimers({ toFake: [ 'setTimeout' ] });

      const callback = sinon.spy();

      // when
      afterPaint(callback);

      await new Promise(resolve => requestAnimationFrame(resolve));

      clock.tick(FRAME_TIMEOUT * 2);

      // then
      expect(callback).to.have.been.calledOnce;
    });


    it('should fall back to timeout without animation frames', async function() {

      // given
      sinon.stub(window, 'requestAnimationFrame').value(undefined);

      const callback = sinon.spy();

      // when
      afterPaint(callback);

      // then
      expect(callback).not.to.have.been.called;

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(callback).to.have.been.calledOnce;
    });


    it('should run without cancelAnimationFrame', async function() {

      // given
      sinon.stub(window, 'cancelAnimationFrame').value(undefined);

      const callback = sinon.spy();
      const canceledCallback = sinon.spy();

      // when
      afterPaint(callback);

      afterPaint(canceledCallback)();

      await new Promise(resolve => afterPaint(resolve));

      // then
      expect(callback).to.have.been.calledOnce;
      expect(canceledCallback).not.to.have.been.called;
    });


    it('should fall back to timeout if no frame is produced', function() {

      // given
      sinon.stub(window, 'requestAnimationFrame').returns(1);

      clock = sinon.useFakeTimers({ toFake: [ 'setTimeout', 'clearTimeout' ] });

      const callback = sinon.spy();

      // when
      afterPaint(callback);

      clock.tick(FRAME_TIMEOUT - 1);

      // assume
      expect(callback).not.to.have.been.called;

      clock.tick(1);

      // then
      expect(callback).to.have.been.calledOnce;
    });

  });

});
