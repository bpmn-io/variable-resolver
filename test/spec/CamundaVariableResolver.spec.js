import TestContainer from 'mocha-test-container-support';

import CamundaModdle from 'camunda-bpmn-moddle/resources/camunda.json';

import { is } from 'bpmn-js/lib/util/ModelUtil';

import { bootstrapModeler, inject } from '../TestHelper';

import { CamundaVariableResolverModule } from 'lib/';

import simpleXML from '../fixtures/camunda/simple.bpmn';
import emptyXML from '../fixtures/camunda/empty.bpmn';
import complexXML from '../fixtures/camunda/complex.bpmn';

import VariableProvider from '../../lib/VariableProvider';

describe('CamundaVariableResolver', function() {

  let container;

  beforeEach(function() {
    container = TestContainer.get(this);
  });

  const expectVariables = (variables, expectedVariables) => {

    expect(variables.length).to.eql(expectedVariables.length);

    expectedVariables.forEach((expectedVariable) => {
      const {
        name,
        type,
        detail,
        info,
        scope,
        isList,
        origin,
        entries
      } = expectedVariable;


      const actualVariable = variables.find(v => v.name === name);
      expect(actualVariable).to.exist;

      type && expect(actualVariable.type).to.eql(type);
      info && expect(actualVariable.info).to.eql(info);
      detail && expect(actualVariable.info).to.eql(info);
      scope && expect(actualVariable.scope.id).to.eql(scope);
      isList && expect(actualVariable.isList).to.eql(isList);
      entries && expectVariables(actualVariable.entries, entries);

      origin && expect(actualVariable.origin.length).to.eql(origin.length);
      origin && origin.forEach((expectedOrigin) => {
        const foundOrigin = actualVariable.origin.find(o => o.id === expectedOrigin);
        expect(foundOrigin).to.exist;
      });
    });

  };


  describe('#registerProvider', function() {

    beforeEach(
      bootstrapModeler(emptyXML, {
        container,
        additionalModules: [
          CamundaVariableResolverModule
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
      expectVariables(variables, [ { name: 'foo', type: 'String', scope: 'Process_1' } ]);
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
      expectVariables(variables, [ { name: 'foo', type: 'String', scope: 'Process_1' }, { name: 'bar', type: 'String', scope: 'Process_1' } ]);

    }));

  });


  describe('cacheing', function() {

    beforeEach(
      bootstrapModeler(emptyXML, {
        container,
        additionalModules: [
          CamundaVariableResolverModule
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
          CamundaVariableResolverModule
        ]
      })
    );


    it('should merge variables of same scope', inject(async function(variableResolver, elementRegistry) {

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
      expectVariables(variables, [ { name: 'foo', type: 'String', scope: 'Process_1', origin: [ 'ServiceTask_1', 'Process_1' ] } ]);
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
      expectVariables(variables, [ { name: 'foo', type: 'String|Number' } ]);
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
      expectVariables(variables, [
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
      expectVariables(variables, [ {
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

  });


  describe('editor compatibility', function() {

    beforeEach(
      bootstrapModeler(simpleXML, {
        container,
        additionalModules: [
          CamundaVariableResolverModule
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
      expectVariables(variables, [
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
          CamundaVariableResolverModule
        ],
        moddleExtensions: {
          camunda: CamundaModdle
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
      expectVariables(variables, [
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
      expectVariables(variables, [
        { name: 'variable1', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable2', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable3', origin: [ 'Task_2' ], scope: 'SubProcess_1' }
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
      expectVariables(variables, [
        { name: 'variable1', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable2', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable3', origin: [ 'Task_2' ], scope: 'SubProcess_1' },
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
      expectVariables(variables, [
        { name: 'variable1', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable2', origin: [ 'Task_1' ], scope: 'Process_1' },
        { name: 'variable3', origin: [ 'Task_2', 'Task_3' ], scope: 'SubProcess_1' },
      ]);
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