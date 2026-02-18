import { expect } from 'chai';

import TestContainer from 'mocha-test-container-support';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { is } from 'bpmn-js/lib/util/ModelUtil';
import { getInputOutput } from '../../../lib/base/util/ExtensionElementsUtil';

import { bootstrapModeler, inject } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

import chainedMappingsXML from 'test/fixtures/zeebe/mappings/chained-mappings.bpmn';
import primitivesXML from 'test/fixtures/zeebe/mappings/primitives.bpmn';
import mergingXML from 'test/fixtures/zeebe/mappings/merging.bpmn';
import scopeXML from 'test/fixtures/zeebe/mappings/scope.bpmn';
import scriptTaskXML from 'test/fixtures/zeebe/mappings/script-task.bpmn';
import scriptTaskEmptyExpressionXML from 'test/fixtures/zeebe/mappings/script-task-empty-expression.bpmn';
import inputRequirementsXML from 'test/fixtures/zeebe/mappings/input-requirements.bpmn';
import scriptTaskInputsXML from 'test/fixtures/zeebe/mappings/script-task-inputs.bpmn';

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
            { name: 'booleanTrue', type: 'Boolean', info: 'true', entries: [] },
            { name: 'booleanFalse', type: 'Boolean', info: 'false', entries: [] },
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
            { name: 'booleanTrue', detail: 'Boolean', info: 'true', entries: [] },
            { name: 'booleanFalse', detail: 'Boolean', info: 'false', entries: [] },
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
      const root = elementRegistry.get('Participant_1');

      const initialVariables = [ {
        name: 'globalVariable',
        type: 'String',
        info: '1',
        entries: [ ]
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
          name: 'fooOutputVariable',
          type: 'String',
          info: '1'
        },
        {
          name: 'barOutputVariable',
          type: '',
          info: ''
        }
      ]);
    }));


    it('should resolve result variable if no outputs exist', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Participant_4');

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject.processRef);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'resultVariable',
          type: 'String',
          info: '1'
        }
      ]);
    }));


    it('should resolve output instead of result variable if outputs exist', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Participant_3');

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject.processRef);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'output',
          type: 'String',
          info: '2'
        }
      ]);
    }));


    it('should only resolve result variable if input and result variable with same name exist', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('ScriptTask_1');
      const bo = root.businessObject;
      const output = getInputOutput(bo).outputParameters[0];

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject, output);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'foo',
          type: 'String',
          info: '1'
        }
      ]);
    }));


    it('should only resolve the output variable if result variable and output with same name exist', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('ScriptTask_4');
      const bo = root.businessObject;
      const output = getInputOutput(bo).outputParameters[1];

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject, output);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'foo',
          type: 'String',
          info: '2'
        }
      ]);
    }));


    it('should only resolve the output variable if input and output with same name exist', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('ServiceTask_3');
      const bo = root.businessObject;
      const output = getInputOutput(bo).outputParameters[1];

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject, output);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'foo',
          type: 'String',
          info: '2'
        }
      ]);
    }));


    it('should only resolve the latest variable if inputs with same name exist', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('ServiceTask_4');

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'foo',
          type: 'String',
          info: '2'
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


  describe('Input Requirements', function() {

    beforeEach(bootstrap(inputRequirementsXML));


    it('should extract input variables from simple expression', inject(async function(variableResolver) {

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then
      const a = variables.find(v => v.name === 'a');
      const b = variables.find(v => v.name === 'b');
      expect(a).to.exist;
      expect(b).to.exist;
      expect(a.usedBy).to.eql([ 'sum' ]);
      expect(b.usedBy).to.eql([ 'sum' ]);
    }));


    it('should extract input variables with nested properties', inject(async function(variableResolver) {

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then
      const order = variables.find(v => v.name === 'order');
      expect(order).to.exist;
      expect(order.entries).to.have.length(1);
      expect(order.entries[0].name).to.eql('items');
      expect(order.usedBy).to.eql([ 'orderItems' ]);
    }));


    it('should deduplicate input variables across mappings', inject(async function(variableResolver) {

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then - y is used in both input mappings but should only appear once
      const yVars = variables.filter(v => v.name === 'y');
      expect(yVars).to.have.length(1);
    }));


    it('should track multiple usedBy targets', inject(async function(variableResolver) {

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then - y is used in both result1 (=x+y) and result2 (=y+z)
      const y = variables.find(v => v.name === 'y');
      expect(y.usedBy).to.eql([ 'result1', 'result2' ]);
    }));


    it('should extract all unique input variables from multiple mappings', inject(async function(variableResolver) {

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then
      const names = variables.map(v => v.name);
      expect(names).to.include('x');
      expect(names).to.include('y');
      expect(names).to.include('z');
    }));


    it('should scope input requirements to the origin task', inject(async function(variableResolver) {

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then - a is scoped to SimpleTask (the task with the input mapping)
      const a = variables.find(v => v.name === 'a');
      expect(a.scope.id).to.eql('SimpleTask');
    }));


    it('should not duplicate variables already in raw variables', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [ { name: 'a', type: 'Number', scope: root } ],
        variableResolver
      });

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then - 'a' should not be duplicated
      const aVars = variables.filter(v => v.name === 'a');
      expect(aVars).to.have.length(1);
    }));

  });


  describe('Input Requirements - Script Tasks', function() {

    beforeEach(bootstrap(scriptTaskInputsXML));


    it('should extract input variables from script task expression', inject(async function(variableResolver) {

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then
      const a = variables.find(v => v.name === 'a');
      const b = variables.find(v => v.name === 'b');
      expect(a).to.exist;
      expect(b).to.exist;
      expect(a.usedBy).to.eql([ 'firstResult' ]);
      expect(b.usedBy).to.eql([ 'firstResult' ]);
    }));


    it('should extract input variables from second script task', inject(async function(variableResolver) {

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then
      const d = variables.find(v => v.name === 'd');
      const f = variables.find(v => v.name === 'f');
      expect(d).to.exist;
      expect(f).to.exist;
      expect(d.usedBy).to.eql([ 'secondResult' ]);
      expect(f.usedBy).to.eql([ 'secondResult' ]);
    }));


    it('should scope script task inputs to the task element', inject(async function(variableResolver) {

      // when
      const rawVariables = await variableResolver.getRawVariables();
      const variables = rawVariables['Process_1'];

      // then - a is scoped to firstTask, d is scoped to secondTask
      const a = variables.find(v => v.name === 'a');
      const d = variables.find(v => v.name === 'd');
      expect(a.scope.id).to.eql('firstTask');
      expect(d.scope.id).to.eql('secondTask');
    }));


    it('should not include other task inputs in getVariablesForElement', inject(async function(variableResolver, elementRegistry) {

      // given
      const firstTask = elementRegistry.get('firstTask');

      // when
      const variables = await variableResolver.getVariablesForElement(firstTask);

      // then - should have a, b, firstResult but NOT d, f
      const names = variables.map(v => v.name);
      expect(names).to.include('a');
      expect(names).to.include('b');
      expect(names).to.not.include('d');
      expect(names).to.not.include('f');
    }));

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
