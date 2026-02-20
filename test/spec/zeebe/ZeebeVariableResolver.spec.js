import { expect } from 'chai';

import sinon from 'sinon';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';

import { bootstrapModeler, inject } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

import simpleXML from 'test/fixtures/zeebe/simple.bpmn';
import emptyXML from 'test/fixtures/zeebe/empty.bpmn';
import complexXML from 'test/fixtures/zeebe/complex.bpmn';
import complexSubProcessMappingConflictingXML from 'test/fixtures/zeebe/complex.sub-process-mapping-conflict.bpmn';
import agenticAdHocSubProcessXML from 'test/fixtures/zeebe/ad-hoc-sub-process.agentic.bpmn';
import adHocSubProcessOutputCollectionLeakXML from 'test/fixtures/zeebe/ad-hoc-sub-process.output-collection-leak.bpmn';
import connectorsXML from 'test/fixtures/zeebe/connectors.bpmn';
import connectorsSubProcessXML from 'test/fixtures/zeebe/connectors.sub-process.bpmn';
import connectorsOutputMappingXML from 'test/fixtures/zeebe/connectors.output-mapping.bpmn';
import ioMappingsXML from 'test/fixtures/zeebe/ioMappings.bpmn';
import ioMappingsEmptyXML from 'test/fixtures/zeebe/ioMappings.empty.bpmn';
import ioMappingsNullXML from 'test/fixtures/zeebe/ioMappings.null.bpmn';
import subprocessNoOutputMappingXML from 'test/fixtures/zeebe/sub-process.no-output-mapping.bpmn';
import longBrokenExpressionXML from 'test/fixtures/zeebe/long-broken-expression.bpmn';
import immediatelyBrokenExpressionXML from 'test/fixtures/zeebe/immediately-broken-expression.bpmn';
import typeResolutionXML from 'test/fixtures/zeebe/type-resolution.bpmn';

import VariableProvider from 'lib/VariableProvider';
import { getInputOutput } from '../../../lib/base/util/ExtensionElementsUtil';
import { mergeEntries } from '../../../lib/base/VariableResolver';


describe('ZeebeVariableResolver', function() {

  describe('#registerProvider', function() {

    beforeEach(
      bootstrapModeler(emptyXML, {
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
      expect(variables).to.variableEqual([ { name: 'foo', type: 'Number|String' } ]);
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


    it('should type nested entry with no value as Null', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [ {
          name: 'a',
          entries: [
            {
              name: 'b',
              entries: [
                { name: 'c' }
              ]
            }
          ]
        } ],
        variableResolver
      });

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      expect(variables).to.variableEqual([ {
        name: 'a',
        entries: [
          {
            name: 'b',
            entries: [
              { name: 'c', type: 'Null' }
            ]
          }
        ]
      } ]);
    }));


    it('should not fail when merging entries with mixed type presence', inject(async function(variableResolver, elementRegistry) {

      // given - one provider supplies a type, the other does not
      const root = elementRegistry.get('Process_1');

      createProvider({
        variables: [ {
          name: 'a',
          type: 'String',
          entries: [
            { name: 'b', type: 'Number' }
          ]
        } ],
        variableResolver
      });
      createProvider({
        variables: [ {
          name: 'a',
          entries: [
            { name: 'b' }
          ]
        } ],
        variableResolver
      });

      // when / then - should not throw
      const variables = await variableResolver.getVariablesForElement(root);

      expect(variables).to.variableEqual([ {
        name: 'a',
        type: 'String',
        entries: [
          { name: 'b', type: 'Number' }
        ]
      } ]);
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


    describe('hierarchical names', function() {

      it('should expand name', inject(async function(variableResolver, elementRegistry) {

        // given
        const root = elementRegistry.get('Process_1');

        createProvider({
          variables: [ { name: 'foo.bar', type: 'String', scope: root } ],
          variableResolver,
          origin: 'Process_1'
        });

        // when
        const variables = await variableResolver.getVariablesForElement(root);

        // then
        expect(variables).to.variableEqual([
          {
            name: 'foo',
            type: 'Context',
            scope: 'Process_1',
            entries: [
              { name: 'bar', type: 'String', scope: 'Process_1' }
            ]
          }
        ]);
      }));


      it('should merge same prefix variables with same scope', inject(async function(variableResolver, elementRegistry) {

        // given
        const root = elementRegistry.get('Process_1');

        createProvider({
          variables: [ { name: 'foo.bar', type: 'String', scope: root } ],
          variableResolver,
          origin: 'Process_1'
        });
        createProvider({
          variables: [ { name: 'foo.woop', type: 'String', scope: root } ],
          variableResolver,
          origin: 'ServiceTask_1'
        });

        // when
        const variables = await variableResolver.getVariablesForElement(root);

        // then
        expect(variables).to.variableEqual([
          {
            name: 'foo',
            type: 'Context',
            scope: 'Process_1',
            entries: [
              { name: 'bar', type: 'String', scope: 'Process_1' },
              { name: 'woop', type: 'String', scope: 'Process_1' }
            ]
          }
        ]);
      }));


      it('should merge same prefix variables with different types', inject(async function(variableResolver, elementRegistry) {

        // given
        const root = elementRegistry.get('Process_1');

        createProvider({
          variables: [ { name: 'foo.bar', type: 'String', scope: root } ],
          variableResolver,
          origin: 'Process_1'
        });
        createProvider({
          variables: [ { name: 'foo.bar', type: 'Boolean', scope: root } ],
          variableResolver,
          origin: 'Process_1'
        });
        createProvider({
          variables: [ { name: 'foo.bar.woop', type: 'Number', scope: root } ],
          variableResolver,
          origin: 'Process_1'
        });

        // when
        const variables = await variableResolver.getVariablesForElement(root);

        // then
        expect(variables).to.variableEqual([
          {
            name: 'foo',
            type: 'Context',
            scope: 'Process_1',
            entries: [
              {
                name: 'bar',
                type: 'Boolean|Context|String',
                scope: 'Process_1',
                entries: [
                  { name: 'woop', type: 'Number', scope: 'Process_1' }
                ]
              }
            ]
          }
        ]);
      }));


      it('should not merge same prefix variables with different scope', inject(async function(variableResolver, elementRegistry) {

        // given
        const root = elementRegistry.get('Process_1');
        const serviceTask = elementRegistry.get('ServiceTask_1');

        createProvider({
          variables: [ { name: 'foo.bar', type: 'String', scope: root } ],
          variableResolver,
          origin: 'Process_1'
        });
        createProvider({
          variables: [ { name: 'foo.woop', type: 'String', scope: serviceTask } ],
          variableResolver,
          origin: 'ServiceTask_1'
        });

        // when
        const processVariables = await variableResolver.getVariablesForElement(root);

        // then
        expect(processVariables).to.variableEqual([
          {
            name: 'foo',
            type: 'Context',
            scope: 'Process_1',
            entries: [
              { name: 'bar', type: 'String', scope: 'Process_1' }
            ]
          }
        ]);

        // when
        const serviceTaskVariables = await variableResolver.getVariablesForElement(serviceTask);

        // then
        expect(serviceTaskVariables).to.variableEqual([
          {
            name: 'foo',
            type: 'Context',
            scope: 'Process_1',
            entries: [
              { name: 'bar', type: 'String', scope: 'Process_1' }
            ]
          },
          {
            name: 'foo',
            type: 'Context',
            scope: 'ServiceTask_1',
            entries: [
              { name: 'woop', type: 'String', scope: 'ServiceTask_1' }
            ]
          }
        ]);
      }));

    });

  });


  describe('editor compatibility', function() {

    beforeEach(
      bootstrapModeler(simpleXML, {
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
      const variables = await variableResolver.getVariablesForElement(root);

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


  describe('scope - sub-process without output mapping', function() {

    beforeEach(
      bootstrapModeler(subprocessNoOutputMappingXML, {
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
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      // own variables
      expect(variables).to.variableEqual([
        { name: 'variable4', origin: [ 'Task_3' ], scope: 'Process_1' }
      ]);
    }));


    it('should extract process variables - sub-process', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('SubProcess_1');

      // when
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      // own variables
      expect(variables).to.variableEqual([
        { name: 'variable4', origin: [ 'Task_3' ], scope: 'Process_1' },
        { name: 'variable3', origin: [ 'SubProcess_1' ], scope: 'SubProcess_1' }
      ]);
    }));

  });


  describe('scope - conflicting mapping', function() {

    beforeEach(
      bootstrapModeler(complexSubProcessMappingConflictingXML, {
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
      const variables = await variableResolver.getVariablesForElement(root);

      // then
      // own variables
      expect(variables).to.variableEqual([
        { name: 'variable4', origin: [ 'Task_3', 'SubProcess_2' ], scope: 'Process_1' }
      ]);
    }));

  });


  describe('connectors', function() {

    beforeEach(
      bootstrapModeler(connectorsXML, {
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
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      expect(variables).to.variableEqual([ ]);
    }));


    it('should add variables from resultVariable header', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('resultVariableTask');

      // when
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      expect(variables).to.variableEqual([
        { name: 'resultVariable', origin: [ 'resultVariableTask' ] },
      ]);
    }));


    it('should add variables from resultExpression header', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('resultExpressionTask');

      // when
      const variables = await variableResolver.getVariablesForElement(task);

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
      const variables = await variableResolver.getVariablesForElement(task);

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
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      expect(variables).to.variableEqual([]);

    }));


    it('should not blow up on missing mapping', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('missingMappingTask');

      // when
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      expect(variables).to.variableEqual([]);

    }));

  });


  describe('connectors - output mapping', function() {

    beforeEach(
      bootstrapModeler(connectorsOutputMappingXML, {
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      })
    );


    it('should output map variables', inject(
      async function(variableResolver, elementRegistry) {

        // given
        const rootElement = elementRegistry.get('Process_1');

        // when
        const variables = await variableResolver.getVariablesForElement(rootElement);

        // then
        expect(variables).to.variableEqual([
          { name: 'resultVariableMapped', origin: [ 'resultVariableTask' ], scope: 'Process_1' },
          { name: 'otherVariableMapped', origin: [ 'resultVariableNotMappedTask' ], scope: 'Process_1' },
          { name: 'expressionVariableMapped', origin: [ 'resultExpressionTask' ], scope: 'Process_1' }
        ]);
      }
    ));


    it('should treat variables from resultVariable header as local', inject(
      async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('resultVariableTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableEqual([
          { name: 'resultVariableMapped', origin: [ 'resultVariableTask' ], scope: 'Process_1' },
          { name: 'otherVariableMapped', origin: [ 'resultVariableNotMappedTask' ], scope: 'Process_1' },
          { name: 'expressionVariableMapped', origin: [ 'resultExpressionTask' ], scope: 'Process_1' },
          { name: 'resultVariable', origin: [ 'resultVariableTask' ], scope: 'resultVariableTask' }
        ]);
      }
    ));


    it('should treat variables from resultExpression header as local', inject(
      async function(variableResolver, elementRegistry) {

        // given
        const task = elementRegistry.get('resultExpressionTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableEqual([
          { name: 'resultVariableMapped', origin: [ 'resultVariableTask' ], scope: 'Process_1' },
          { name: 'otherVariableMapped', origin: [ 'resultVariableNotMappedTask' ], scope: 'Process_1' },
          { name: 'expressionVariableMapped', origin: [ 'resultExpressionTask' ], scope: 'Process_1' },
          { name: 'expressionVariable', origin: [ 'resultExpressionTask' ], scope: 'resultExpressionTask' },
          { name: 'anotherExpressionVariable', origin: [ 'resultExpressionTask' ], scope: 'resultExpressionTask' }
        ]);
      }
    ));

  });


  describe('connectors - sub-process', function() {

    beforeEach(
      bootstrapModeler(connectorsSubProcessXML, {
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      })
    );


    it('should expose sub-process scoped variables', inject(async function(variableResolver, elementRegistry) {

      // given
      const subProcess = elementRegistry.get('SubProcess_1');

      // when
      const variables = await variableResolver.getVariablesForElement(subProcess);

      // then
      expect(variables).to.variableEqual([
        { name: 'resultVariable', origin: [ 'Activity_10' ], scope: 'Process_1' },
        { name: 'expressionVariable', origin: [ 'Activity_11' ], scope: 'Process_1' },
        { name: 'anotherExpressionVariable', origin: [ 'Activity_11', 'SubProcess_1' ], scope: 'SubProcess_1' },
      ]);
    }));


    it('should expose process scoped variables', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('Process_1');

      // when
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      expect(variables).to.variableEqual([
        { name: 'resultVariable', origin: [ 'Activity_10' ], scope: 'Process_1' },
        { name: 'expressionVariable', origin: [ 'Activity_11' ], scope: 'Process_1' }
      ]);
    }));

  });


  describe('agentic - ad-hoc sub-process', function() {

    beforeEach(
      bootstrapModeler(agenticAdHocSubProcessXML, {
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      })
    );


    it('should expose agent scoped variables', inject(async function(variableResolver, elementRegistry) {

      // given
      const subProcess = elementRegistry.get('AI_Agent');

      // when
      const variables = await variableResolver.getVariablesForElement(subProcess);

      // then
      expect(variables).to.variableEqual([
        { name: 'agent', origin: [ 'AI_Agent' ], scope: 'ai-agent-chat-with-tools' },
        {
          name: 'toolCallResult',
          origin: [
            'AskHumanToSendEmail',
            'GetDateAndTime',
            'SuperfluxProduct',
            'SendEmail',
            'LoadUserByID',
            'ListUsers',
            'Search_Recipe',
            'Jokes_API',
            'Fetch_URL'
          ],
          scope: 'ai-agent-chat-with-tools'
        },
        { name: 'toolCallResults', origin: [ 'AI_Agent' ], scope: 'ai-agent-chat-with-tools' },
        {
          name: 'data',
          scope: 'AI_Agent',
          entries: [
            {
              name: 'response',
              scope: 'AI_Agent',
              entries: [
                { name: 'includeAgentContext', scope: 'AI_Agent' },
                { name: 'includeAssistantMessage' },
                { name: 'format' }
              ]
            },
            {
              name: 'events',
              entries: [
                { name: 'behavior' }
              ]
            },
            {
              name: 'limits'
            },
            {
              name: 'memory',
              entries: [
                { name: 'contextWindowSize' },
                { name: 'storage' }
              ]
            },
            {
              name: 'userPrompt'
            },
            {
              name: 'systemPrompt'
            }
          ]
        },
        {
          name: 'provider',
          scope: 'AI_Agent',
          entries: [
            {
              name: 'type',
              scope: 'AI_Agent'
            },
            {
              name: 'bedrock',
              entries: [
                { name: 'region' },
                { name: 'authentication' },
                { name: 'model' }
              ]
            }
          ]
        },
        { name: 'agentContext', origin: [ 'AI_Agent' ], scope: 'AI_Agent' }
      ]);
    }));


    it('should expose process scoped variables', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('ai-agent-chat-with-tools');

      // when
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      expect(variables).to.variableEqual([
        { name: 'toolCallResults', scope: 'ai-agent-chat-with-tools' },
        { name: 'toolCallResult', scope: 'ai-agent-chat-with-tools' },
        { name: 'agent', origin: [ 'AI_Agent' ], scope: 'ai-agent-chat-with-tools' }
      ]);
    }));


    it('should type toolCallResult with joined toolCall value types', inject(async function(variableResolver, elementRegistry) {

      // given
      const subProcess = elementRegistry.get('AI_Agent');

      // when
      const variables = await variableResolver.getVariablesForElement(subProcess);

      // then
      expect(variables).to.variableInclude({
        name: 'toolCallResult',
        type: 'Any|Context|Null|String'
      });
    }));


    it('should type nested entries of expanded hierarchical variables', inject(async function(variableResolver, elementRegistry) {

      // given
      const subProcess = elementRegistry.get('AI_Agent');

      // when
      const variables = await variableResolver.getVariablesForElement(subProcess);
      const dataVariable = variables.find(v => v.name === 'data');

      // then
      expect(dataVariable).to.exist;
      expect(dataVariable.type).to.equal('Context');

      const systemPrompt = dataVariable.entries.find(e => e.name === 'systemPrompt');
      expect(systemPrompt).to.exist;
      expect(systemPrompt.type).to.equal('Context');

      const prompt = systemPrompt.entries.find(e => e.name === 'prompt');
      expect(prompt).to.exist;
      expect(prompt.type).to.equal('Null');
    }));

  });


  describe('ad-hoc sub-process - output collection', function() {

    beforeEach(
      bootstrapModeler(adHocSubProcessOutputCollectionLeakXML, {
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      })
    );


    it('should indicate variable leak', inject(async function(variableResolver, elementRegistry) {

      // given
      const subProcess = elementRegistry.get('AdHocSubProcess_1');

      // when
      const variables = await variableResolver.getVariablesForElement(subProcess);

      // then
      expect(variables).to.variableEqual([
        { name: 'outputCollection', origin: [ 'AdHocSubProcess_1' ], scope: 'Process_1' }
      ]);

      // and given
      const root = elementRegistry.get('Process_1');

      // when
      const rootVariables = await variableResolver.getVariablesForElement(root);

      // then
      expect(rootVariables).to.variableInclude({
        name: 'outputCollection',
        origin: [ 'AdHocSubProcess_1' ],
        scope: 'Process_1'
      });
    }));

  });


  describe('io mappings', function() {

    beforeEach(
      bootstrapModeler(ioMappingsXML, {
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


  describe('io mappings - empty', function() {

    beforeEach(
      bootstrapModeler(ioMappingsEmptyXML, {
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      })
    );


    it('should map as <null>', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('ServiceTask_1');

      // when
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      expect(variables).to.variableEqual([
        { name: 'emptyInput', type: 'Null', scope: 'ServiceTask_1' }
      ]);

    }));

  });


  describe('io mappings - null', function() {

    beforeEach(
      bootstrapModeler(ioMappingsNullXML, {
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      })
    );


    it('should declare Null type', inject(async function(variableResolver, elementRegistry) {

      // given
      const task = elementRegistry.get('ServiceTask_1');

      // when
      const variables = await variableResolver.getVariablesForElement(task);

      // then
      // filter own name, later input mappings + all output mappings
      expect(variables).to.variableEqual([
        { name: 'nullInput', type: 'Null', scope: 'ServiceTask_1' },
        { name: 'nullOutput', type: 'Null', scope: 'Process_1' }
      ]);

    }));

  });


  describe('parsing', function() {

    describe('long broken expression', function() {

      beforeEach(bootstrapModeler(longBrokenExpressionXML, {
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      }));


      it('should NOT error on a long broken expression', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('TASK_WITH_LONG_BROKEN_EXPRESSION');
        const bo = getBusinessObject(task);

        // when
        const variables = await variableResolver.getVariablesForElement(bo);

        // then
        expect(variables).to.variableEqual([
          { name: 'target' }
        ]);
      }));

    });


    describe('immediately broken expression', function() {

      beforeEach(bootstrapModeler(immediatelyBrokenExpressionXML, {
        additionalModules: [
          ZeebeVariableResolverModule
        ],
        moddleExtensions: {
          zeebe: ZeebeModdle
        }
      }));


      it('should NOT error on an immediate syntax error', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('TASK_WITH_IMMEDIATELY_BROKEN_EXPRESSION');
        const bo = getBusinessObject(task);

        // when
        const variables = await variableResolver.getVariablesForElement(bo);

        // then
        expect(variables).to.variableEqual([
          { name: 'target' }
        ]);
      }));
    });
  });


  describe('variable type resolution', function() {

    beforeEach(bootstrapModeler(typeResolutionXML, {
      additionalModules: [
        ZeebeVariableResolverModule
      ],
      moddleExtensions: {
        zeebe: ZeebeModdle
      }
    }));


    describe('literal type outputs', function() {

      it('should resolve null literal to Null', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('literalNullTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'outNull',
          type: 'Null',
          scope: 'Process_varResolution'
        });
      }));


      it('should resolve string literal to String', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('literalStringTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'outString',
          type: 'String',
          scope: 'Process_varResolution'
        });
      }));


      it('should resolve number literal to Number', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('literalNumberTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'outNumber',
          type: 'Number',
          scope: 'Process_varResolution'
        });
      }));


      it('should resolve boolean literal to Boolean', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('literalBooleanTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'outBoolean',
          type: 'Boolean',
          scope: 'Process_varResolution'
        });
      }));


      it('should resolve context literal to Context', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('literalContextTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'outContext',
          type: 'Context',
          scope: 'Process_varResolution'
        });
      }));


      it('should resolve empty source to Null', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('emptySourceTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'outEmpty',
          type: 'Null',
          scope: 'Process_varResolution'
        });
      }));

    });


    describe('path expression resolution', function() {

      it('should resolve path to string property', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('pathConsumerTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'pathString',
          type: 'String',
          scope: 'pathConsumerTask'
        });
      }));


      it('should resolve path to number property', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('pathConsumerTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'pathNumber',
          type: 'Number',
          scope: 'pathConsumerTask'
        });
      }));


      it('should resolve path to boolean property', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('pathConsumerTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'pathBoolean',
          type: 'Boolean',
          scope: 'pathConsumerTask'
        });
      }));


      it('should resolve deep path to null property', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('pathConsumerTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'pathDeepNull',
          type: 'Null',
          scope: 'pathConsumerTask'
        });
      }));

    });


    describe('variable passthrough', function() {

      it('should resolve passthrough variable to source type', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('passthroughConsumerTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'passedString',
          type: 'String',
          scope: 'passthroughConsumerTask'
        });
      }));

    });


    describe('unresolved variables', function() {

      it('should resolve unresolved variable to Any', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('unresolvedConsumerTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'unresolvedInput',
          type: 'Any',
          scope: 'unresolvedConsumerTask'
        });
      }));

    });


    describe('nested reference resolution', function() {

      it('should resolve nested output to Context with Null-typed leaf', inject(async function(elementRegistry, variableResolver) {

        // given
        const task = elementRegistry.get('nestedConsumerTask');

        // when
        const variables = await variableResolver.getVariablesForElement(task);

        // then
        expect(variables).to.variableInclude({
          name: 'nested',
          type: 'Context',
          scope: 'Process_varResolution',
          entries: [
            {
              name: 'deep',
              type: 'Context',
              entries: [
                { name: 'leaf', type: 'String' }
              ]
            }
          ]
        });
      }));

    });

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