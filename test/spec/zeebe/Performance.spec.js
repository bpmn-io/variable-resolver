import { expect } from 'chai';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';

import { bootstrapModeler, inject } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

import VariableProvider from 'lib/VariableProvider';

import simpleXML from 'test/fixtures/zeebe/simple.bpmn';
import nestedXML from 'test/fixtures/zeebe/perf-nested.bpmn';


/**
 * Performance benchmarks for the variable resolver.
 *
 * Each describe block targets a specific code path to make
 * the impact of individual optimizations measurable.
 *
 * Results are logged as JSON to the console and can be captured
 * from the Karma output to track regressions.
 */
describe('Performance', function() {

  this.timeout(30000);

  const results = {};

  after(function() {
    console.log('\n\n=== PERF_RESULTS_START ===');
    console.log(JSON.stringify(results, null, 2));
    console.log('=== PERF_RESULTS_END ===\n');
  });

  function bench(name, fn) {
    const t0 = performance.now();
    const result = fn();
    const duration = performance.now() - t0;
    results[name] = { duration };
    return result;
  }

  async function benchAsync(name, fn) {
    const t0 = performance.now();
    const result = await fn();
    const duration = performance.now() - t0;
    results[name] = { duration };
    return result;
  }


  // ------------------------------------------------------------------
  // A) _parseVariables — duplicate merging (Map vs find)
  //    Stresses: _parseVariables in BaseVariableResolver
  //    Targeted by: Optimization 1
  // ------------------------------------------------------------------
  describe('_parseVariables — duplicate merging', function() {

    beforeEach(
      bootstrapModeler(simpleXML, {
        additionalModules: [ ZeebeVariableResolverModule ],
        moddleExtensions: { zeebe: ZeebeModdle }
      })
    );


    for (const count of [ 500, 2000, 5000 ]) {

      it(`${count} variables, 50% duplicates across 2 providers`, inject(
        async function(variableResolver, elementRegistry) {

          // given
          const root = elementRegistry.get('Process_1');

          const vars1 = [];
          for (let i = 0; i < count; i++) {
            vars1.push({ name: 'var_' + i, type: 'String', scope: root });
          }
          createProvider({ variables: vars1, variableResolver, origin: 'Process_1' });

          const vars2 = [];
          for (let i = count / 2; i < count * 1.5; i++) {
            vars2.push({ name: 'var_' + i, type: 'Number', scope: root });
          }
          createProvider({ variables: vars2, variableResolver, origin: 'ServiceTask_1' });

          // when
          const variables = await benchAsync(
            `parseVariables_${count}_50pct_dupes`,
            () => variableResolver.getVariablesForElement(root)
          );

          // then
          expect(variables.length).to.equal(count * 1.5);
        }
      ));
    }

  });


  // ------------------------------------------------------------------
  // B) getVariablesForElement — scope filtering with parent lookup
  //    Stresses: parent ID collection + filtering in getVariablesForElement
  //    Targeted by: Optimization 2 + 6
  // ------------------------------------------------------------------
  describe('getVariablesForElement — parent scope filtering', function() {

    beforeEach(
      bootstrapModeler(nestedXML, {
        additionalModules: [ ZeebeVariableResolverModule ],
        moddleExtensions: { zeebe: ZeebeModdle }
      })
    );


    for (const count of [ 500, 2000, 5000 ]) {

      it(`${count} variables across nested scopes, query deep element`, inject(
        async function(variableResolver, elementRegistry) {

          // given — distribute variables across all scope levels
          const allElements = elementRegistry.getAll().filter(
            e => getBusinessObject(e).$type !== 'bpmn:SequenceFlow'
              && getBusinessObject(e).$type !== 'bpmn:Definitions'
          );

          const scopes = allElements.length > 0 ? allElements : [ elementRegistry.get('Process_1') ];

          const variables = [];
          for (let i = 0; i < count; i++) {
            variables.push({
              name: 'nested_' + i,
              type: 'String',
              scope: scopes[i % scopes.length]
            });
          }
          createProvider({ variables, variableResolver });

          // query from deepest element
          const deepElement = elementRegistry.get('Task_deep_1') || elementRegistry.get('Process_1');

          // when
          const result = await benchAsync(
            `scopeFilter_nested_${count}`,
            () => variableResolver.getVariablesForElement(deepElement)
          );

          // then
          expect(result.length).to.be.greaterThan(0);
        }
      ));
    }

  });


  // ------------------------------------------------------------------
  // C) _extractor — many elements × many providers (sync fast-path)
  //    Stresses: _extractor loop and Promise creation
  //    Targeted by: Optimization 5
  // ------------------------------------------------------------------
  describe('_extractor — many providers', function() {

    beforeEach(
      bootstrapModeler(simpleXML, {
        additionalModules: [ ZeebeVariableResolverModule ],
        moddleExtensions: { zeebe: ZeebeModdle }
      })
    );


    for (const providerCount of [ 50, 200 ]) {

      it(`${providerCount} sync providers × 10 variables each`, inject(
        async function(variableResolver, elementRegistry) {

          // given
          const root = elementRegistry.get('Process_1');

          for (let p = 0; p < providerCount; p++) {
            const vars = [];
            for (let v = 0; v < 10; v++) {
              vars.push({ name: `p${p}_v${v}`, type: 'String', scope: root });
            }
            createProvider({ variables: vars, variableResolver });
          }

          // when
          const result = await benchAsync(
            `extractor_${providerCount}providers_sync`,
            () => variableResolver.getVariablesForElement(root)
          );

          // then
          expect(result.length).to.equal(providerCount * 10);
        }
      ));
    }

  });


  // ------------------------------------------------------------------
  // D) FEEL resolution — filterForScope + resolveReferences
  //    Stresses: filterForScope (Set vs find) and resolveReferences (Set filter)
  //    Targeted by: Optimization 3 + 4
  //    Uses the nested BPMN with actual IO mappings / FEEL expressions
  // ------------------------------------------------------------------
  describe('FEEL resolution — nested IO mappings', function() {

    beforeEach(
      bootstrapModeler(nestedXML, {
        additionalModules: [ ZeebeVariableResolverModule ],
        moddleExtensions: { zeebe: ZeebeModdle }
      })
    );


    it('resolve variables on deeply nested diagram with IO mappings', inject(
      async function(variableResolver, elementRegistry) {

        // given — add many additional variables to increase the work in filterForScope
        const root = elementRegistry.get('Process_1');
        const allElements = elementRegistry.getAll().filter(
          e => getBusinessObject(e).$type !== 'bpmn:SequenceFlow'
            && getBusinessObject(e).$type !== 'bpmn:Definitions'
        );

        const scopes = allElements.length > 0 ? allElements : [ root ];

        const vars = [];
        for (let i = 0; i < 1000; i++) {
          vars.push({
            name: 'extra_' + i,
            type: 'String',
            scope: scopes[i % scopes.length]
          });
        }
        createProvider({ variables: vars, variableResolver });

        const deepElement = elementRegistry.get('Task_deep_1') || root;

        // when
        const result = await benchAsync(
          'feel_nested_io_mappings',
          () => variableResolver.getVariablesForElement(deepElement)
        );

        // then
        expect(result.length).to.be.greaterThan(0);
      }
    ));

  });


  // ------------------------------------------------------------------
  // E) Repeated invalidation — full pipeline repeated
  //    Stresses: all paths together under repeated cache invalidation
  // ------------------------------------------------------------------
  describe('repeated invalidation', function() {

    beforeEach(
      bootstrapModeler(simpleXML, {
        additionalModules: [ ZeebeVariableResolverModule ],
        moddleExtensions: { zeebe: ZeebeModdle }
      })
    );


    it('10x invalidation + resolve with 2000 variables', inject(
      async function(variableResolver, elementRegistry, eventBus) {

        // given
        const root = elementRegistry.get('Process_1');
        const vars = [];
        for (let i = 0; i < 2000; i++) {
          vars.push({ name: 'var_' + i, type: 'String', scope: root });
        }
        createProvider({ variables: vars, variableResolver });

        // when
        const t0 = performance.now();
        for (let i = 0; i < 10; i++) {
          eventBus.fire('commandStack.changed');
          await variableResolver.getVariablesForElement(root);
        }
        const duration = performance.now() - t0;

        results['repeated_10x_2000vars'] = { duration, avg: duration / 10 };

        // then
        expect(duration).to.be.a('number');
      }
    ));

  });

});


// helpers //////////////////////

const createProvider = function({ variables, variableResolver, origin, delay = 0 }) {
  return new class TestProvider extends VariableProvider {
    getVariables(element) {
      if (origin) {
        return origin === element.id ? this.returnVariables() : [];
      }

      if (is(element, 'bpmn:Process')) {
        return this.returnVariables();
      }
    }

    returnVariables() {
      if (delay) {
        return new Promise(resolve => {
          setTimeout(() => resolve(variables), delay);
        });
      }

      return variables;
    }
  }(variableResolver);
};
