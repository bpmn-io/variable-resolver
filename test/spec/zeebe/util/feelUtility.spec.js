import { expect } from 'chai';

import {
  normalizeContextKey,
  parser
} from '@bpmn-io/lezer-feel';

import {
  getResultContext,
  isPlainName,
  pickReferenced,
  toUnifiedFormat
} from 'lib/zeebe/util/feelUtility';


describe('zeebe/util/feelUtility', function() {

  describe('isPlainName', function() {

    it('should match names the parser reads as single identifier', function() {

      // given
      this.timeout(10000);

      const mismatches = [];

      // when
      for (let code = 0; code <= 0xFFFF; code++) {
        const char = String.fromCharCode(code);

        for (const name of [ char + 'b', 'a' + char + 'b' ]) {
          const expected = isIdentifier(name) && isNormalized(char);

          if (isPlainName(name) !== expected) {
            mismatches.push(`U+${ code.toString(16).padStart(4, '0') } in ${ JSON.stringify(name) }`);
          }
        }
      }

      // then
      expect(mismatches).to.be.empty;
    });

  });


  describe('pickReferenced', function() {

    const REFERENCED = [
      '"order id": 1',
      'order: "open"',
      'orders: [ { "order id": 1, order: "a", x: 1 }, { "order id": 2, order: "b", x: 5 } ]',
      'ctx: { "order id": 5, foo: 1 }',
      'date: "today"',
      'item: "root item"',
      'x: 10',
      'y: 20'
    ];

    // names that start like names or keywords in the expressions below
    const UNREFERENCED = [
      'dateOfBirth', 'timeout', 'durationMs', 'orderX', 'ordersCount', 'items',
      'ctxs', 'iff', 'thenX', 'elseX', 'forEach', 'inx', 'returnValue', 'someX',
      'everyX', 'satisfiesX', 'instanceOf', 'notX', 'nullable', 'betweenX',
      'andX', 'orX', 'functionX', 'trueish'
    ];

    const EXPRESSIONS = [
      '=date("2020-01-01")',
      '=date and time("2020-01-01T10:00:00")',
      '=time("10:00:00")',
      '=duration("P1D")',
      '={ d: date, t: time("10:00:00") }',
      '={ a: date and foo, b: x }',
      '=@"2020-01-01"',
      '=if x > 1 then y else x',
      '=for i in [ 1, 2 ] return i + x',
      '=every i in [ 1, 2 ] satisfies i < y',
      '=x instance of number',
      '=x between 1 and y or false',
      '=(function(z) z + y)(1)',
      '=not(x > 1)',
      '={ n: null, t: true }',
      '=orders[order id > 1]',
      '=orders[order = "a"]',
      '=orders[item.x > x]',
      '=orders.order id',
      '=get value(ctx, "order id")',
      '=`order id`',
      '=for x in [ 1 ] return x',
      '=some order in orders satisfies order.x > 1',
      '={ x: 1, y: x, z: order id, order id: 2, w: order id }',
      '=order identifier'
    ];


    for (const expression of EXPRESSIONS) {

      it(`should keep result of <${ expression }>`, function() {

        // given
        const context = createContext();

        // when
        const picked = pickReferenced(context, expression);

        // then
        expect(context.entries).to.include.all.keys(UNREFERENCED);
        expect(picked.entries).not.to.have.any.keys(UNREFERENCED);

        expect(resolve(expression, picked)).to.eql(resolve(expression, createContext()));
      });

    }


    // helpers //////////

    function createContext() {
      const entries = [
        ...REFERENCED,
        ...UNREFERENCED.map(name => `${ name }: "${ name }"`)
      ];

      const context = getResultContext(`={ ${ entries.join(', ') } }`).computedValue();

      return {
        entries: context.value.entries
      };
    }

    function resolve(expression, context) {
      return toUnifiedFormat({
        result: getResultContext(expression, context).computedValue()
      });
    }

  });

});


// helpers //////////

const camundaParser = parser.configure({ dialect: 'camunda' });

/**
 * @param {string} name
 *
 * @return {boolean}
 */
function isIdentifier(name) {
  let identifier;

  camundaParser.parse(name).iterate({
    enter(node) {
      if (!identifier && node.name === 'Identifier') {
        identifier = { from: node.from, to: node.to };
      }
    }
  });

  return !!identifier && identifier.from === 0 && identifier.to === name.length;
}

/**
 * Check that names with the character are looked up as is.
 *
 * @param {string} char
 *
 * @return {boolean}
 */
function isNormalized(char) {
  return [
    char + 'b',
    'a' + char + 'b',
    'a' + char + char + 'b',
    'a' + char
  ].every(name => normalizeContextKey(name) === name);
}
