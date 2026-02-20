import { expect } from 'chai';

import TestContainer from 'mocha-test-container-support';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { is } from 'bpmn-js/lib/util/ModelUtil';
import { getInputOutput } from '../../../lib/base/util/ExtensionElementsUtil';

import { bootstrapModeler, inject } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

import chainedMappingsXML from 'test/fixtures/zeebe/mappings/chained-mappings.bpmn';
import chainedMappingsAnyXML from 'test/fixtures/zeebe/mappings/chained-mappings.any.bpmn';
import primitivesXML from 'test/fixtures/zeebe/mappings/primitives.bpmn';
import mergingXML from 'test/fixtures/zeebe/mappings/merging.bpmn';
import mergingNullXML from 'test/fixtures/zeebe/mappings/merging.null.bpmn';
import mergingAnyXML from 'test/fixtures/zeebe/mappings/merging.any.bpmn';
import mergingChildrenXML from 'test/fixtures/zeebe/mappings/merging.children.bpmn';
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


  describe('Mappings - any', function() {

    beforeEach(bootstrap(chainedMappingsAnyXML));


    it('should map <Any>', inject(async function(variableResolver, elementRegistry) {

      // given
      const subProcess = elementRegistry.get('SubProcess_3');
      const task = elementRegistry.get('Task_9');

      // when
      const variables = await variableResolver.getVariablesForElement(subProcess);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'nonExisting_fromProcess',
          type: 'Any',
          scope: 'SubProcess_3'
        },
        {
          name: 'result_fromSubProcess',
          type: 'Any',
          scope: 'Process_6'
        },
        {
          name: 'result_fromProcess',
          type: 'Any',
          scope: 'Process_6'
        }
      ]);

      // when
      const taskVariables = await variableResolver.getVariablesForElement(task);

      // then
      expect(taskVariables).to.variableEqual([
        {
          name: 'nonExisting_fromProcess',
          type: 'Any',
          scope: 'SubProcess_3'
        },
        {
          name: 'result_fromSubProcess',
          type: 'Any',
          scope: 'Process_6'
        },
        {
          name: 'result_fromProcess',
          type: 'Any',
          scope: 'Process_6'
        },
        { name: 'taskVariable_fromSubProcess', scope: 'Task_9', type: 'Any' },
        { name: 'taskVariable_fromProcess', scope: 'Task_9', type: 'Any' }
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
            { name: 'null', type: 'Null', entries: [] },
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
            { name: 'null', detail: 'Null', entries: [] },
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


  describe('Merging - null', function() {

    beforeEach(bootstrap(mergingNullXML));


    it('should combine local <null> and child output', inject(async function(variableResolver, elementRegistry) {

      // given
      const subProcess = elementRegistry.get('SubProcess_1');

      // when
      const variables = await variableResolver.getVariablesForElement(subProcess);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'processVariable',
          type: 'Null|Number',
          scope: 'Process_4',
          origin: [ 'SubProcess_1' ]
        },
        {
          name: 'localVariable',
          type: 'Null|Number',
          scope: 'SubProcess_1',
          origin: [ 'SubProcess_1', 'Task_6' ]
        }
      ]);
    }));

  });


  describe('Merging - children types', function() {

    beforeEach(bootstrap(mergingChildrenXML));


    it('should combine and child productions output', inject(async function(variableResolver, elementRegistry) {

      // given
      const subProcess = elementRegistry.get('SubProcess_2');

      createProvider({
        variables: [],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(subProcess);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'processVariable',
          type: 'Boolean|Number|String',
          scope: 'Process_5'
        },
        {
          name: 'variable',
          type: 'Boolean|Number|String',
          scope: 'SubProcess_2'
        }
      ]);
    }));

  });


  describe('Merging - any', function() {

    beforeEach(bootstrap(mergingAnyXML));


    it('should combine local <Any> and child output', inject(async function(variableResolver, elementRegistry) {

      // given
      const subProcess = elementRegistry.get('SubProcess_4');

      // when
      const variables = await variableResolver.getVariablesForElement(subProcess);

      // then
      expect(variables).to.variableEqual([
        {
          name: 'processVariable',
          type: 'Any|Number',
          scope: 'Process_7'
        },
        {
          name: 'localVariable',
          type: 'Any|Number',
          scope: 'SubProcess_4'
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
          type: 'Any',
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
