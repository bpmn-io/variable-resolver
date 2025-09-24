import TestContainer from 'mocha-test-container-support';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';

import { bootstrapModeler, inject } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

import simpleXML from 'test/fixtures/zeebe/simple.bpmn';
import emptyXML from 'test/fixtures/zeebe/empty.bpmn';
import complexXML from 'test/fixtures/zeebe/complex.bpmn';
import connectorsXML from 'test/fixtures/zeebe/connectors.bpmn';
import ioMappingsXML from 'test/fixtures/zeebe/ioMappings.bpmn';
import longBrokenExpressionXML from 'test/fixtures/zeebe/long-broken-expression.bpmn';

import VariableProvider from 'lib/VariableProvider';
import { getInputOutput } from '../../../lib/base/util/ExtensionElementsUtil';
import { mergeEntries } from '../../../lib/base/VariableResolver';

describe('ZeebeVariableResolver', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  describe('#registerProvider', function() {

    beforeEach(
      bootstrapModeler(emptyXML, {
        container,
        additionalModules: [
          ZeebeVariableResolverModule
        ]
      })
    );


    it('should register additional providers', inject(async function(variableResolver) {

      // given
      const spy = sinon.spy();
      const resolver = {
        getVariables: spy
      };

      // when
      variableResolver.registerProvider(resolver);
      await variableResolver.getVariables();

      // then
      expect(spy).to.have.been.calledOnce;
    }));


    it('should only call provider when required', inject(async function(variableResolver) {

      // given
      const spy = sinon.spy();
      const resolver = {
        getVariables: spy
      };

      // when
      variableResolver.registerProvider(resolver);

      // then
      expect(spy).not.to.have.been.called;
    }));


    it('should supply variables', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [ { name: 'foo', type: 'String', scope: root } ],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      expect(variables).to.variableEqual([ { name: 'foo', type: 'String', scope: 'Process_1' } ]);
    }));


    it('should be side-effect free', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      const variable = {
        name: 'foo',
        type: 'String',
        entries: [
          {
            name: 'bar'
          }
        ]
      };

      createProvider({
        variables: [ variable ],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      expect(variables[0].scope).to.exist;
      expect(variable.scope).not.to.exist;
      expect(Object.keys(variable)).to.have.length(3);
      expect(Object.keys(variable.entries[0])).to.have.length(1);
    }));


    it('should allow multiple providers', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [ { name: 'foo', type: 'String', scope: root } ],
        variableResolver
      });
      createProvider({
        variables: [ { name: 'bar', type: 'String', scope: root } ],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      expect(variables).to.variableEqual([ { name: 'foo', type: 'String', scope: 'Process_1' }, { name: 'bar', type: 'String', scope: 'Process_1' } ]);

    }));


    it('should add provider meta-data', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      const variableProvider = createProvider({
        variables: [ { name: 'foo', type: 'String', scope: root } ],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      const provider = variables[0].provider;

      // then
      expect(provider).to.exist;
      expect(provider).to.have.length(1);
      expect(provider[0]).to.equal(variableProvider);

    }));


    describe('async', function() {

      beforeEach(
        bootstrapModeler(simpleXML, {
          container,
          additionalModules: [
            ZeebeVariableResolverModule
          ]
        })
      );


      it('should allow multiple async providers', inject(async function(variableResolver, elementRegistry) {

        // given
        const root = elementRegistry.get('Process_1');

        createProvider({
          variables: [ { name: 'foo', type: 'String', scope: root } ],
          variableResolver,
          delay: 1
        });
        createProvider({
          variables: [ { name: 'bar', type: 'String', scope: root } ],
          variableResolver,
          delay: 1
        });

        // when
        const variables = await variableResolver.getVariablesForElement(root);

        // then
        expect(variables).to.variableEqual(
          [
            { name: 'foo', type: 'String', scope: 'Process_1' },
            { name: 'bar', type: 'String', scope: 'Process_1' }
          ]);

      }));

    });

  });


  describe('caching', function() {

    beforeEach(
      bootstrapModeler(emptyXML, {
        container,
        additionalModules: [
          ZeebeVariableResolverModule
        ]
      })
    );


    it('should cache results', inject(async function(variableResolver) {

      // given
      const spy = sinon.spy();
      const resolver = {
        getVariables: spy
      };
      variableResolver.registerProvider(resolver);

      // when
      await variableResolver.getVariables();
      await variableResolver.getVariables();

      // then
      expect(spy).to.have.been.calledOnce;
    }));


    it('should refresh on commandstack changed', inject(async function(variableResolver, eventBus) {

      // given
      const spy = sinon.spy();
      const resolver = {
        getVariables: spy
      };

      variableResolver.registerProvider(resolver);

      // when
      await variableResolver.getVariables();
      eventBus.fire('commandStack.changed');
      await variableResolver.getVariables();

      // then
      expect(spy).to.have.been.calledTwice;
    }));


    it('should refresh on diagram clear', inject(async function(variableResolver, eventBus) {

      // given
      const spy = sinon.spy();
      const resolver = {
        getVariables: spy
      };

      variableResolver.registerProvider(resolver);

      // when
      await variableResolver.getVariables();
      eventBus.fire('diagram.clear');
      await variableResolver.getVariables();

      // then
      expect(spy).to.have.been.calledTwice;
    }));


    it('should refresh on diagram import.done', inject(async function(variableResolver, eventBus) {

      // given
      const spy = sinon.spy();
      const resolver = {
        getVariables: spy
      };

      variableResolver.registerProvider(resolver);

      // when
      await variableResolver.getVariables();
      eventBus.fire('import.done');
      await variableResolver.getVariables();

      // then
      expect(spy).to.have.been.calledTwice;
    }));


    it('should refresh on variables.changed', inject(async function(variableResolver, eventBus) {

      // given
      const spy = sinon.spy();
      const resolver = {
        getVariables: spy
      };

      variableResolver.registerProvider(resolver);

      // when
      await variableResolver.getVariables();
      eventBus.fire('variables.changed');
      await variableResolver.getVariables();

      // then
      expect(spy).to.have.been.calledTwice;
    }));


    it('should refresh on new resolver', inject(async function(variableResolver, eventBus) {

      // given
      const spy = sinon.spy();
      const secondSpy = sinon.spy();

      const resolver = {
        getVariables: spy
      };
      const secondResolver = {
        getVariables: secondSpy
      };

      variableResolver.registerProvider(resolver);

      // when
      await variableResolver.getVariables();

      variableResolver.registerProvider(secondResolver);

      await variableResolver.getVariables();


      // then
      expect(spy).to.have.been.calledTwice;
      expect(secondSpy).to.have.been.calledOnce;

    }));

  });


  describe('merging', function() {

    beforeEach(
      bootstrapModeler(simpleXML, {
        container,
        additionalModules: [
          ZeebeVariableResolverModule
        ]
      })
    );


    it('should merge variables of same scope and same name', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [ { name: 'foo', type: 'String', scope: root } ],
        variableResolver,
        origin: 'Process_1'
      });
      createProvider({
        variables: [ { name: 'foo', type: 'String', scope: root } ],
        variableResolver,
        origin: 'ServiceTask_1'
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      expect(variables).to.variableEqual([
        { name: 'foo', type: 'String', scope: 'Process_1', origin: [ 'ServiceTask_1', 'Process_1' ] }
      ]);
    }));


    it('should not merge variables of different scopes and same name', inject(async function(variableResolver, elementRegistry) {

      // given
      const serviceTask1 = elementRegistry.get('ServiceTask_1'),
            serviceTask2 = elementRegistry.get('ServiceTask_2');

      createProvider({
        variables: [ { name: 'foo', type: 'String', scope: serviceTask1 } ],
        variableResolver,
        origin: 'ServiceTask_1'
      });
      createProvider({
        variables: [ { name: 'foo', type: 'String', scope: serviceTask2 } ],
        variableResolver,
        origin: 'ServiceTask_2'
      });

      // when
      let variables = await variableResolver.getVariablesForElement(serviceTask1);

      // then
      expect(variables).to.variableEqual([
        { name: 'foo', type: 'String', scope: 'ServiceTask_1', origin: [ 'ServiceTask_1' ] },
      ]);

      // when
      variables = await variableResolver.getVariablesForElement(serviceTask2);

      // then
      expect(variables).to.variableEqual([
        { name: 'foo', type: 'String', scope: 'ServiceTask_2', origin: [ 'ServiceTask_2' ] },
      ]);
    }));


    it('should merge variables types', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [ { name: 'foo', type: 'String' } ],
        variableResolver
      });
      createProvider({
        variables: [ { name: 'foo', type: 'Number' } ],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      expect(variables).to.variableEqual([ { name: 'foo', type: 'String|Number' } ]);
    }));


    it('should merge variables list type', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [
          { name: 'noList', type: 'String' },
          { name: 'optionalList', type: 'String', isList: true },
          { name: 'allList', type: 'String', isList: true }
        ],
        variableResolver
      });
      createProvider({
        variables: [
          { name: 'noList', type: 'String' },
          { name: 'optionalList', type: 'String' },
          { name: 'allList', type: 'String', isList: true }
        ],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      expect(variables).to.variableEqual([
        { name: 'noList', type: 'String', isList: false },
        { name: 'optionalList', type: 'String', isList: 'optional' },
        { name: 'allList', type: 'String', isList: true }
      ]);
    }));


    it('should merge variables entries', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [ {
          name: 'foo',
          entries: [
            {
              name: 'bar',
              entries: [
                { name: 'a' }
              ]
            }
          ]
        },
        {
          name: 'qux'
        } ],
        variableResolver
      });
      createProvider({
        variables: [ {
          name: 'foo',
          entries: [
            {
              name: 'bar',
              entries: [ { name: 'b' } ]
            },
            { name: 'baz' }
          ]
        },
        {
          name: 'qux',
          entries: [ {
            name: 'quz'
          } ]
        } ],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      expect(variables).to.variableEqual([ {
        name: 'foo', entries: [
          {
            name: 'bar',
            entries: [
              { name: 'a' },
              { name: 'b' }
            ]
          },
          {
            name: 'baz'
          }
        ]
      },
      {
        name: 'qux', entries: [
          { name: 'quz' }
        ]
      }
      ]);
    }));


    it('should not fail on infinite loop', function() {

      // given
      const source = {
        name: 'foo',
        entries: []
      };

      source.entries.push(source);

      const target = {
        name: 'foo',
        entries: []
      };

      target.entries.push(target);

      // when
      mergeEntries(source, target);

      // then
      expect([ target ]).to.variableEqual([ { name: 'foo' } ]);
    });

  });


  describe('editor compatibility', function() {

    beforeEach(
      bootstrapModeler(simpleXML, {
        container,
        additionalModules: [
          ZeebeVariableResolverModule
        ]
      })
    );


    it('should map type => details', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [
          {
            name: 'a',
            type: 'String',
            entries: [
              { name: 'b', type: 'Number' }
            ]
          }
        ],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      expect(variables).to.variableEqual([
        { name: 'a', detail: 'String', entries: [
          { name: 'b', detail: 'Number' }
        ] },
      ]);
    }));

  });


  describe('scope', function() {

    beforeEach(
      bootstrapModeler(complexXML, {
        container,
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      })
    );


    it('should extract process variables - process', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      // when
      const variables = await variableResolver.getVariablesForElement(root.businessObject);

      // then
      // own variables
      expect(variables).to.variableEqual([
        { name: 'variable1', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable2', origin: [ 'Task_1' ], scope: 'Process_1' },
      ]);
    }));


    it('should extract process variables - sub process', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('Task_2');

      // when
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      // own + all variables from parent scope
      expect(variables).to.variableEqual([
        { name: 'variable1', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable2', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable3', origin: [ 'SubProcess_1', 'Task_2' ], scope: 'SubProcess_1' }
      ]);
    }));


    it('should scope additional variables to task with output mappings', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('Task_2');

      createProvider({
        variables: [ { name: 'foo' } ],
        origin: 'Task_2',
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      // own + all variables from parent scope
      expect(variables).to.variableEqual([
        { name: 'variable1', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable2', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable3', origin: [ 'SubProcess_1', 'Task_2' ], scope: 'SubProcess_1' },
        { name: 'foo', origin: [ 'Task_2' ], scope: 'Task_2' }
      ]);
    }));


    it('should scope additional variables to nearest scoped parent', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('Task_3');

      createProvider({
        variables: [ { name: 'variable3' } ],
        origin: 'Task_3',
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      // own + all variables from parent scope
      expect(variables).to.variableEqual([
        { name: 'variable1', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable2', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable3', origin: [ 'SubProcess_1', 'Task_2', 'Task_3' ], scope: 'SubProcess_1' },
      ]);
    }));

  });


  describe('connectors', function() {

    beforeEach(
      bootstrapModeler(connectorsXML, {
        container,
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      })
    );


    it('should NOT add variables on missing headers', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('emptyTask');

      // when
      const variables = await variableResolver.getVariablesForElement(task.businessObject);

      // then
      expect(variables).to.variableEqual([ ]);
    }));


    it('should add variables from resultVariable header', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('resultVariableTask');

      // when
      const variables = await variableResolver.getVariablesForElement(task.businessObject);

      // then
      expect(variables).to.variableEqual([
        { name: 'resultVariable', origin: [ 'resultVariableTask' ] },
      ]);
    }));


    it('should add variables from resultExpression header', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('resultExpressionTask');

      // when
      const variables = await variableResolver.getVariablesForElement(task.businessObject);

      // then
      expect(variables).to.variableEqual([
        { name: 'expressionVariable', origin: [ 'resultExpressionTask' ] },
        { name: 'anotherExpressionVariable', origin: [ 'resultExpressionTask' ] },
      ]);

    }));


    it('should add variables from both headers', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('variableAndExpressionTask');

      // when
      const variables = await variableResolver.getVariablesForElement(task.businessObject);

      // then
      expect(variables).to.variableEqual([
        { name: 'resultVariable', origin: [ 'variableAndExpressionTask' ] },
        { name: 'expressionVariable', origin: [ 'variableAndExpressionTask' ] },
        { name: 'anotherExpressionVariable', origin: [ 'variableAndExpressionTask' ] },
      ]);

    }));


    it('should not blow up on empty mapping', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('emptyMappingTask');

      // when
      const variables = await variableResolver.getVariablesForElement(task.businessObject);

      // then
      expect(variables).to.variableEqual([]);

    }));


    it('should not blow up on missing mapping', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('missingMappingTask');

      // when
      const variables = await variableResolver.getVariablesForElement(task.businessObject);

      // then
      expect(variables).to.variableEqual([]);

    }));

  });


  describe('io mappings', function() {

    beforeEach(
      bootstrapModeler(ioMappingsXML, {
        container,
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      })
    );


    describe('single origin', function() {

      it('should filter for inputs', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('singleOriginTask');
        const bo = getBusinessObject(task);
        const input = getInputOutput(bo).inputParameters[1];

        // when
        const variables = await variableResolver.getVariablesForElement(bo, input);

        // then
        // filter own name, later input mappings + all output mappings
        expect(variables).to.variableEqual([
          { name: 'input1' }
        ]);

      }));


      it('should filter for outputs', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('singleOriginTask');
        const bo = getBusinessObject(task);
        const output = getInputOutput(bo).outputParameters[1];

        // when
        const variables = await variableResolver.getVariablesForElement(bo, output);

        // then
        // filter own name, later output mappings
        expect(variables).to.variableEqual([
          { name: 'input1' },
          { name: 'input2' },
          { name: 'input3' },
          { name: 'output1' }
        ]);

      }));


      it('should filter for task', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('singleOriginTask');
        const bo = getBusinessObject(task);

        // when
        const variables = await variableResolver.getVariablesForElement(bo, task);

        // then
        // filter own name, later output mappings
        expect(variables).to.variableEqual([
          { name: 'input1' },
          { name: 'input2' },
          { name: 'input3' }
        ]);

      }));

    });


    describe('multi origin', function() {

      it('should filter for inputs', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('multiOriginTask');
        const bo = getBusinessObject(task);
        const input = getInputOutput(bo).inputParameters[1];

        // when
        const variables = await variableResolver.getVariablesForElement(bo, input);

        // then
        // filter own name, later input mappings + all output mappings
        expect(variables).to.variableEqual([
          { name: 'input1' },
          { name: 'output2' }
        ]);

      }));


      it('should filter for outputs', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('multiOriginTask');
        const bo = getBusinessObject(task);
        const input = getInputOutput(bo).outputParameters[1];

        // when
        const variables = await variableResolver.getVariablesForElement(bo, input);

        // then
        // filter own name, later output mappings
        expect(variables).to.variableEqual([
          { name: 'input1' },
          { name: 'input2' },
          { name: 'input3' },
          { name: 'output1' },
          { name: 'output2' }
        ]);

      }));


      it('should filter for task', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('multiOriginTask');
        const bo = getBusinessObject(task);

        // when
        const variables = await variableResolver.getVariablesForElement(bo, task);

        // then
        // filter own name, later output mappings
        expect(variables).to.variableEqual([
          { name: 'input1' },
          { name: 'input2' },
          { name: 'input3' },
          { name: 'output2' },
        ]);

      }));

    });


    describe('additional extractors', function() {


      it('should suggest additional variables (output)', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('singleOriginTask');
        const bo = getBusinessObject(task);
        const output = getInputOutput(bo).outputParameters[1];

        createProvider({
          variables: [
            { name: 'output2' }
          ],
          origin: 'singleOriginTask',
          variableResolver
        });

        // when
        const variables = await variableResolver.getVariablesForElement(bo, output);

        // then
        expect(variables).to.variableEqual([
          { name: 'input1' },
          { name: 'input2' },
          { name: 'input3' },
          { name: 'output1' },
          { name: 'output2' }
        ]);
      }));


      it('should NOT suggest additional variables (input)', inject(async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('singleOriginTask');
        const bo = getBusinessObject(task);
        const output = getInputOutput(bo).inputParameters[1];

        createProvider({
          variables: [
            { name: 'output2' }
          ],
          origin: 'singleOriginTask',
          variableResolver
        });

        // when
        const variables = await variableResolver.getVariablesForElement(bo, output);

        // then
        expect(variables).to.variableEqual([
          { name: 'input1' }
        ]);
      }));

    });

  });


  describe('parsing', function() {

    beforeEach(bootstrapModeler(longBrokenExpressionXML, {
      container,
      additionalModules: [
        ZeebeVariableResolverModule
      ],
      moddleExtensions: {
        zeebe: ZeebeModdle
      }
    }));


    it('should NOT error on a long broken expression', inject(async function(elementRegistry, variableResolver) {

      // given
      const task = elementRegistry.get('Task_1');
      const bo = getBusinessObject(task);
      const input = getInputOutput(bo).inputParameters[1];

      // when
      const variables = await variableResolver.getVariablesForElement(bo, input);

      // then
      expect(variables).to.variableEqual([
        { name: 'target' }
      ]);
    }));
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