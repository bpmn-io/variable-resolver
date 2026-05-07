import { expect } from 'chai';

import { VariableContext } from '@bpmn-io/lezer-feel';

import { EntriesContext, UnionContext } from 'lib/zeebe/util/VariableContext';


function toEntriesContextValue(context) {

  return context && Object.keys(context).reduce((result, key) => {
    const value = context[key];

    result.entries[key] = typeof value === 'object' ? toEntriesContextValue(value)
      : value;

    return result;
  }, { entries: {} });
}


describe('UnionContext', function() {

  describe('EntriesContext.of', function() {

    it('should return EntriesContext for single arg', function() {

      // when
      const context = EntriesContext.of({ entries: { a: 1 } });

      // then
      expect(context).to.be.instanceOf(EntriesContext);
      expect(context).not.to.be.instanceOf(UnionContext);
    });


    it('should return UnionContext for 2 args', function() {

      // when
      const context = EntriesContext.of(
        { entries: { a: 1 } },
        { entries: { b: 2 } }
      );

      // then
      expect(context).to.be.instanceOf(UnionContext);
      expect(context.variants).to.have.length(2);
    });


    it('should create union from contexts', function() {

      // when
      const context = EntriesContext.of(
        EntriesContext.of(
          toEntriesContextValue({ a: { ab: 10 } })
        ),
        EntriesContext.of(
          toEntriesContextValue({ a: { ac: 20 } })
        )
      );

      // then
      expect(context).to.be.instanceOf(UnionContext);
      expect(context.variants).to.have.length(2);
      expect(context.getKeys()).to.include('a');
    });


    it('should create empty', function() {

      // when
      const context = EntriesContext.of({});

      // then
      expect(context).to.be.instanceOf(EntriesContext);
      expect(context).to.eql({
        value: {
          entries: { }
        }
      });
    });

  });


  describe('EntriesContext.toVariant', function() {

    it('should return VariableContext subclass as-is', function() {

      // given
      const existing = EntriesContext.of({ entries: { x: 1 } });

      // when
      const result = EntriesContext.toVariant(existing);

      // then
      expect(result).to.equal(existing);
    });


    it('should wrap plain value', function() {

      // when
      const result = EntriesContext.toVariant({ entries: { y: 2 } });

      // then
      expect(result).to.be.instanceOf(EntriesContext);
      expect(result.getKeys()).to.include('y');
    });


    it('should wrap atomic value', function() {

      // when
      const result = EntriesContext.toVariant(42);

      // then
      expect(result).to.be.instanceOf(EntriesContext);
      expect(result.value.atomicValue).to.eql(42);
    });

  });


  describe('UnionContext.getKeys', function() {

    it('should return union of all keys', function() {

      // given
      const context = EntriesContext.of(
        { entries: { a: 1, b: 2 } },
        { entries: { b: 3, c: 4 } }
      );

      // when
      const keys = context.getKeys();

      // then
      expect(keys).to.include('a');
      expect(keys).to.include('b');
      expect(keys).to.include('c');
      expect(keys).to.have.length(3);
    });

  });


  describe('UnionContext.get', function() {

    it('should return value when only one variant has key', function() {

      // given
      const context = EntriesContext.of(
        { entries: { a: 1 } },
        { entries: { b: 2 } }
      );

      // when
      const result = context.get('a');

      // then
      expect(result).to.be.instanceOf(EntriesContext);
      expect(result).not.to.be.instanceOf(UnionContext);
    });


    it('should return UnionContext when multiple variants have key', function() {

      // given
      const context = EntriesContext.of(
        { entries: { a: { entries: { x: 1 } } } },
        { entries: { a: { entries: { y: 2 } } } }
      );

      // when
      const result = context.get('a');

      // then
      expect(result).to.be.instanceOf(UnionContext);
      expect(result.variants).to.have.length(2);
    });


    it('should return null when no variant has key', function() {

      // given
      const context = EntriesContext.of(
        { entries: { a: 1 } },
        { entries: { b: 2 } }
      );

      // when
      const result = context.get('z');

      // then
      expect(result).to.be.null;
    });

  });


  describe('UnionContext.set', function() {

    it('should add new variant', function() {

      // given
      const context = EntriesContext.of(
        { entries: { a: 1 } },
        { entries: { b: 2 } }
      );

      // when
      const updated = context.set('c', 3);

      // then
      expect(updated).to.be.instanceOf(UnionContext);
      expect(updated.variants).to.have.length(3);
      expect(updated.getKeys()).to.include('c');
    });

  });


  describe('UnionContext extends VariableContext', function() {

    it('should be instance of VariableContext', function() {

      // given
      const context = EntriesContext.of(
        { entries: { a: 1 } },
        { entries: { b: 2 } }
      );

      // then
      expect(context).to.be.instanceOf(VariableContext);
    });

  });

});
