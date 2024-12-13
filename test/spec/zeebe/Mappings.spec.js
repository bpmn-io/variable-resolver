import TestContainer from 'mocha-test-container-support';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { is } from 'bpmn-js/lib/util/ModelUtil';

import { bootstrapModeler, inject } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

import chainedMappingsXML from 'test/fixtures/zeebe/mappings/chained-mappings.bpmn';
import primitivesXML from 'test/fixtures/zeebe/mappings/primitives.bpmn';
import mergingXML from 'test/fixtures/zeebe/mappings/merging.bpmn';
import scopeXML from 'test/fixtures/zeebe/mappings/scope.bpmn';
import scriptTaskXML from 'test/fixtures/zeebe/mappings/script-task.bpmn';
import scriptTaskEmptyExpressionXML from 'test/fixtures/zeebe/mappings/script-task-empty-expression.bpmn';

import VariableProvider from 'lib/VariableProvider';

describe('ZeebeVariableResolver - Variable Mappings', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });


  const bootstrap = (xml) => {
    return bootstrapModeler(xml, {
      container,
      additionalModules: [
        ZeebeVariableResolverModule
      ],
      moddleExtensions: {
        zeebe: ZeebeModdle
      }
    });
  };

  describe('Mappings', function() {

    beforeEach(bootstrap(chainedMappingsXML));

    it('should keep schema through multiple mappings', inject(async function(variableResolver, elementRegistry) {

      // given
      createProvider({
        variables: toVariableFormat({ globalVariable: { foo: { bar: { baz: {} } } } }),
        variableResolver
      });

      const root = elementRegistry.get('Process_1');

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject);

      // then
      expect(variables).to.variableEqual([
        ...toVariableFormat({ globalVariable: { foo: { bar: { baz: {} } } } }),
        { name: 'variable1', type: 'fooType', info: 'fooInfo', entries: toVariableFormat({ bar: { baz: {} } }) },
        { name: 'variable2', type: 'barType', info: 'barInfo', entries: toVariableFormat({ baz: {} }) },
        { name: 'variable3', type: 'bazType', info: 'bazInfo', entries: [] },
        { name: 'variable4', type: 'bazType', info: 'bazInfo', entries: [] }
      ]);
    }));

  });


  describe('Primitives', function() {

    beforeEach(bootstrap(primitivesXML));


    it('should add type description for primitive data types', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject);


      // then
      expect(variables).to.variableEqual([
        {
          name: 'genericTypes',
          type: 'Context',
          info: '',
          entries: [
            { name: 'string', type: 'String', info: 'foo', entries: [] },
            { name: 'number', type: 'Number', info: '1', entries: [] },
            { name: 'boolean', type: 'Boolean', info: 'true', entries: [] },
            { name: 'null', type: '', entries: [] },
          ]
        }
      ]);
    }));


    it('should map to editor format (detail, info, entries)', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'genericTypes',
          detail: 'Context',
          info: '',
          entries: [
            { name: 'string', detail: 'String', info: 'foo', entries: [] },
            { name: 'number', detail: 'Number', info: '1', entries: [] },
            { name: 'boolean', detail: 'Boolean', info: 'true', entries: [] },
            { name: 'null', detail: '', entries: [] },
          ]
        }
      ]);
    }));

  });


  describe('Merging', function() {

    beforeEach(bootstrap(mergingXML));


    it('should merge multiple variables (if-else)', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Participant_1');

      const initialVariables = [ {
        name: 'globalVariable',
        type: 'TestVariable',
        info: 'TestInfo',
        entries: [
          { name: 'foo' },
        ]
      } ];

      createProvider({
        variables: initialVariables,
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject.processRef);

      // then
      expect(variables).to.variableEqual([
        ...initialVariables,
        {
          name: 'mergedContext',
          type: 'Context',
          entries: [
            { name: 'a', type: 'TestVariable', info: 'TestInfo', entries: [ { name: 'foo' } ] },
            { name: 'b', type: 'TestVariable', info: 'TestInfo', entries: [ { name: 'foo' } ] }
          ]
        }
      ]);
    }));


    it('should merge variables with global context', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Participant_1');

      const initialVariables = [
        {
          name: 'globalVariable',
          type: 'TestVariable',
          info: 'TestInfo',
          entries: [
            { name: 'foo' },
          ]
        },
        {
          name: 'mergedContext',
          type: 'globalType',
          info: 'globalInfo',
          entries: [
            { name: 'bar' },
          ]
        }
      ];

      createProvider({
        variables: initialVariables,
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject.processRef);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'globalVariable',
          type: 'TestVariable',
          info: 'TestInfo',
          entries: [
            { name: 'foo' },
          ]
        },
        {
          name: 'mergedContext',
          type: 'globalType|Context',
          entries: [
            { name: 'a', type: 'TestVariable', info: 'TestInfo', entries: [ { name: 'foo' } ] },
            { name: 'b', type: 'TestVariable', info: 'TestInfo', entries: [ { name: 'foo' } ] },
            { name: 'bar' }
          ]
        }
      ]);
    }));


    it('should merge multiple variables', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Participant_2');

      createProvider({
        variables: [],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject.processRef);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'multipleSources',
          type: 'Context|String',
          entries: [
            { name: 'a' },
            { name: 'b' },
          ]
        }
      ]);
    }));


    it('should handle many merge operations', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Participant_3');

      createProvider({
        variables: [],
        variableResolver
      });

      // when
      // this failed previously in an infinite loop, cf. https://github.com/camunda/camunda-modeler/issues/4139
      const variables = await variableResolver.getVariablesForElement(root.businessObject.processRef);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'foo'
        }
      ]);
    }));

  });


  describe('Scope', function() {

    beforeEach(bootstrap(scopeXML));


    it('should only resolve variables in scope', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      const initialVariables = [ {
        name: 'globalVariable',
        type: 'TestVariable',
        info: 'TestInfo',
        entries: [ ]
      } ];

      createProvider({
        variables: initialVariables,
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject);

      // then
      expect(variables).to.variableEqual([
        ...initialVariables,
        {
          name: 'validMapping',
          type: 'TestVariable',
          info: 'TestInfo'
        },
        {
          name: 'invalidMapping',
          type: '',
          info: ''
        }
      ]);
    }));

  });


  describe('Script Task', function() {

    describe('valid', function() {

      beforeEach(bootstrap(scriptTaskXML));


      it('should add type annotation for script tasks', inject(async function(variableResolver, elementRegistry) {

        // given
        const element = elementRegistry.get('ScriptTask');

        // when
        const variables = await variableResolver.getVariablesForElement(element.businessObject);

        // then
        expect(variables).to.variableEqual([
          {
            name: 'scriptResult',
            type: 'Context',
            info: '',
            entries: [
              { name: 'foo', type: 'Number', info: '123', entries: [] },
            ]
          }
        ]);
      }));
    });


    describe('empty expression', function() {

      beforeEach(bootstrap(scriptTaskEmptyExpressionXML));


      it('should NOT error for empty expression', inject(async function(variableResolver, elementRegistry) {

        // given
        const element = elementRegistry.get('ScriptTask');

        // when
        const variables = await variableResolver.getVariablesForElement(element.businessObject);

        // then
        expect(variables).to.variableEqual([
          {
            name: 'scriptResult'
          }
        ]);
      }));
    });
  });

});

// helpers //////////////////////

const createProvider = function({ variables, variableResolver, origin }) {
  return new class TestProvider extends VariableProvider {
    getVariables(element) {
      if (origin) {
        return origin === element.id ? variables : [];
      }

      if (is(element, 'bpmn:Process')) {
        return variables;
      }
    }
  }(variableResolver);
};

function toVariableFormat(variables) {
  return Object.keys(variables).map(v => {
    return {
      name: v,
      info: v + 'Info',
      type: v + 'Type',
      entries: toVariableFormat(variables[v])
    };
  });
}
