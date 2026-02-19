import { expect } from 'chai';
import sinon from 'sinon';

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
import scriptTaskWithInputMappingsXML from 'test/fixtures/zeebe/mappings/script-task-with-input-mappings.bpmn';
import inputOutputConflictXML from 'test/fixtures/zeebe/mappings/input-output-conflict.bpmn';
import emptyXML from 'test/fixtures/zeebe/empty.bpmn';

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
      const variables = (await variableResolver.getVariables())['Process_1'];

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
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then
      const order = variables.find(v => v.name === 'order');
      expect(order).to.exist;
      expect(order.entries).to.have.length(1);
      expect(order.entries[0].name).to.eql('items');
      expect(order.usedBy).to.eql([ 'orderItems' ]);
    }));


    it('should deduplicate input variables across mappings', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then - y is used in both input mappings but should only appear once
      const yVars = variables.filter(v => v.name === 'y');
      expect(yVars).to.have.length(1);
    }));


    it('should track multiple usedBy targets', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then - y is used in both result1 (=x+y) and result2 (=y+z)
      const y = variables.find(v => v.name === 'y');
      expect(y.usedBy).to.eql([ 'result1', 'result2' ]);
    }));


    it('should extract all unique input variables from multiple mappings', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then
      const names = variables.map(v => v.name);
      expect(names).to.include('x');
      expect(names).to.include('y');
      expect(names).to.include('z');
    }));


    it('should merge entries from multiple expressions referencing the same variable', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then - a.b and a.c should result in a: { entries: [b, c] }
      const a = variables.find(v => v.name === 'a' && v.origin.some(o => o.id === 'MergedEntriesTask'));
      expect(a).to.exist;
      expect(a.entries).to.have.length(2);

      const entryNames = a.entries.map(e => e.name);
      expect(entryNames).to.include('b');
      expect(entryNames).to.include('c');
    }));


    it('should scope input requirements to the origin task', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then - a originates from SimpleTask (the task with the input mapping)
      const a = variables.find(v => v.name === 'a' && v.origin[0].id === 'SimpleTask');
      expect(a).to.exist;
      expect(a.scope).to.not.exist;
    }));


    it('should keep provider and extracted variables separate', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [ { name: 'a', type: 'Number', scope: root } ],
        variableResolver
      });

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then - provider 'a' (with scope) and extracted 'a' (without scope) coexist
      const scopedA = variables.find(v => v.name === 'a' && v.scope);
      const unscopedA = variables.find(v => v.name === 'a' && !v.scope);
      expect(scopedA).to.exist;
      expect(unscopedA).to.exist;
    }));

  });


  describe('Input Requirements - Input/Output Conflict', function() {

    beforeEach(bootstrap(inputOutputConflictXML));


    it('should extract input requirement from input mapping when another task has output mapping with same name', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then - foo is used in the input mapping of InputTask, so it should be an input requirement
      const fooRequirements = variables.filter(v => v.name === 'foo' && v.usedBy && v.usedBy.length > 0);

      // Both InputTask and OutputTask use `foo` in input expressions, so both should have
      // separate input requirements (not merged into one with multiple origins)
      expect(fooRequirements).to.have.length(2);

      const inputTaskFoo = fooRequirements.find(v => v.origin[0].id === 'InputTask');
      const outputTaskFoo = fooRequirements.find(v => v.origin[0].id === 'OutputTask');
      expect(inputTaskFoo).to.exist;
      expect(outputTaskFoo).to.exist;
      expect(inputTaskFoo.origin).to.have.length(1);
      expect(outputTaskFoo.origin).to.have.length(1);
    }));


    it('should return foo as input requirement for InputTask via getInputRequirementsForElement', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('InputTask');

      // when
      const requirements = await variableResolver.getInputRequirementsForElement(task);

      // then
      const names = requirements.map(v => v.name);
      expect(names).to.include('foo');
    }));


    it('should return foo as input requirement for OutputTask via getInputRequirementsForElement', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('OutputTask');

      // when
      const requirements = await variableResolver.getInputRequirementsForElement(task);

      // then
      const names = requirements.map(v => v.name);
      expect(names).to.include('foo');
    }));

  });


  describe('Input Requirements - Script Tasks', function() {

    beforeEach(bootstrap(scriptTaskInputsXML));


    it('should extract input variables from script task expression', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];

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
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then
      const d = variables.find(v => v.name === 'd');
      const f = variables.find(v => v.name === 'f');
      expect(d).to.exist;
      expect(f).to.exist;
      expect(d.usedBy).to.eql([ 'secondResult' ]);
      expect(f.usedBy).to.eql([ 'secondResult' ]);
    }));


    it('should associate script task inputs with the task origin', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];

      // then - a originates from firstTask, d originates from secondTask
      const a = variables.find(v => v.name === 'a');
      const d = variables.find(v => v.name === 'd');
      expect(a.origin[0].id).to.eql('firstTask');
      expect(d.origin[0].id).to.eql('secondTask');
      expect(a.scope).to.not.exist;
      expect(d.scope).to.not.exist;
    }));


    it('should not include input requirements in getVariablesForElement', inject(async function(variableResolver, elementRegistry) {

      // given
      const firstTask = elementRegistry.get('firstTask');

      // when
      const variables = await variableResolver.getVariablesForElement(firstTask);

      // then - input requirements (a, b, d, f) should not appear since they have no scope
      const names = variables.map(v => v.name);
      expect(names).to.not.include('a');
      expect(names).to.not.include('b');
      expect(names).to.not.include('d');
      expect(names).to.not.include('f');
    }));

  });


  describe('Input Requirements - Script Task with Input Mappings', function() {

    beforeEach(bootstrap(scriptTaskWithInputMappingsXML));


    it('should extract input requirements from input mapping expressions but not from script for locally mapped variables', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];
      const withUsedBy = variables.filter(v => v.usedBy && v.usedBy.length > 0);
      const names = withUsedBy.map(v => v.name);

      // then - input requirements should come from input mapping expressions only;
      // localA and localB are provided by the input mappings, so the script's
      // references to them should NOT produce input requirements
      expect(names).to.include('processVar1');
      expect(names).to.include('processVar2');
      expect(names).to.not.include('localA');
      expect(names).to.not.include('localB');
    }));


    it('should still extract input requirements from script without input mappings', inject(async function(variableResolver) {

      // when
      const variables = (await variableResolver.getVariables())['Process_1'];
      const withUsedBy = variables.filter(v => v.usedBy && v.usedBy.length > 0);
      const names = withUsedBy.map(v => v.name);

      // then - the second script task has no input mappings, so its script variables should be extracted
      expect(names).to.include('x');
      expect(names).to.include('y');
    }));

  });


  describe('#getInputRequirementsForElement', function() {

    describe('with input mappings', function() {

      beforeEach(bootstrap(inputRequirementsXML));


      it('should return input requirements for a simple task', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('SimpleTask');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then - both 'a' and 'b' are input requirements for SimpleTask
        const names = requirements.map(v => v.name);
        expect(names).to.include('a');
        expect(names).to.include('b');
        expect(requirements).to.have.length(2);
      }));


      it('should return requirements with nested properties', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('NestedTask');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then
        expect(requirements).to.have.length(1);
        expect(requirements[0].name).to.eql('order');
        expect(requirements[0].entries).to.have.length(1);
        expect(requirements[0].entries[0].name).to.eql('items');
      }));


      it('should return requirements from multiple input mappings', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('MultiInputTask');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then
        const names = requirements.map(v => v.name);
        expect(names).to.include('x');
        expect(names).to.include('y');
        expect(names).to.include('z');
      }));


      it('should return empty array for element without input requirements', inject(async function(variableResolver, elementRegistry) {

        // given
        const process = elementRegistry.get('Process_1');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(process);

        // then
        expect(requirements).to.be.an('array').that.is.empty;
      }));


      it('should not return variables from other elements', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('SimpleTask');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then - should not include variables from MultiInputTask or NestedTask
        const names = requirements.map(v => v.name);
        expect(names).to.not.include('x');
        expect(names).to.not.include('z');
        expect(names).to.not.include('order');
      }));


      it('should include usedBy information', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('SimpleTask');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then
        const b = requirements.find(v => v.name === 'b');
        expect(b).to.exist;
        expect(b.usedBy).to.eql([ 'sum' ]);
      }));


      it('should return input requirements even when other tasks use the same variable', inject(async function(variableResolver, elementRegistry) {

        // given - MergedEntriesTask uses 'a' which is also used by SimpleTask
        // Input requirements are per-task and should not be merged
        const task = elementRegistry.get('MergedEntriesTask');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then
        expect(requirements).to.have.length(1);
        expect(requirements[0].name).to.eql('a');
        expect(requirements[0].entries).to.have.length(2);
      }));

    });


    describe('with script tasks', function() {

      beforeEach(bootstrap(scriptTaskInputsXML));


      it('should return input requirements for script task', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('firstTask');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then
        const names = requirements.map(v => v.name);
        expect(names).to.include('a');
        expect(names).to.include('b');
      }));


      it('should only return requirements for the requested task', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('secondTask');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then
        const names = requirements.map(v => v.name);
        expect(names).to.include('d');
        expect(names).to.include('f');
        expect(names).to.not.include('a');
        expect(names).to.not.include('b');
      }));

    });


    describe('with script tasks and input mappings', function() {

      beforeEach(bootstrap(scriptTaskWithInputMappingsXML));


      it('should only return process variables as input requirements, not locally mapped ones', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('scriptWithInputs');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then - only processVar1 and processVar2 (from input mapping sources) should
        // be requirements, not localA and localB (input mapping targets used in the script)
        const names = requirements.map(v => v.name);
        expect(names).to.include('processVar1');
        expect(names).to.include('processVar2');
        expect(names).to.not.include('localA');
        expect(names).to.not.include('localB');
        expect(requirements).to.have.length(2);
      }));


      it('should return all script variables for task without input mappings', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('scriptWithoutInputs');

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(task);

        // then
        const names = requirements.map(v => v.name);
        expect(names).to.include('x');
        expect(names).to.include('y');
        expect(requirements).to.have.length(2);
      }));

    });


    describe('error handling', function() {

      beforeEach(bootstrap(emptyXML));


      it('should return empty array when getVariables fails', inject(async function(variableResolver, elementRegistry) {

        // given
        const process = elementRegistry.get('Process_1');
        sinon.stub(variableResolver, 'getVariables').rejects(new Error('test error'));

        // when
        const requirements = await variableResolver.getInputRequirementsForElement(process);

        // then
        expect(requirements).to.be.an('array').that.is.empty;

        variableResolver.getVariables.restore();
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
