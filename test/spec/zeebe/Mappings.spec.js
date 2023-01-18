import TestContainer from 'mocha-test-container-support';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { is } from 'bpmn-js/lib/util/ModelUtil';

import { bootstrapModeler, inject } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

// import simpleXML from '../fixtures/zeebe/simple.bpmn';

import chainedMappingsXML from 'test/fixtures/zeebe/mappings/chained-mappings.bpmn';
import primitivesXML from 'test/fixtures/zeebe/mappings/primitives.bpmn';
import mergingXML from 'test/fixtures/zeebe/mappings/merging.bpmn';
import scopeXML from 'test/fixtures/zeebe/mappings/scope.bpmn';


import VariableProvider from 'lib/VariableProvider';

describe('ZeebeVariableResolver - Variable Mappings', function() {

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

      shouldTest(type) && expect(actualVariable.type).to.eql(type);
      shouldTest(info) && expect(actualVariable.info).to.eql(info);
      shouldTest(detail) && expect(actualVariable.info).to.eql(info);
      shouldTest(scope) && expect(actualVariable.scope.id).to.eql(scope);
      shouldTest(isList) && expect(actualVariable.isList).to.eql(isList);
      shouldTest(entries) && expectVariables(actualVariable.entries, entries);

      shouldTest(origin) && expect(actualVariable.origin.length).to.eql(origin.length);
      shouldTest(origin) && origin.forEach((expectedOrigin) => {
        const foundOrigin = actualVariable.origin.find(o => o.id === expectedOrigin);
        expect(foundOrigin).to.exist;
      });
    });

  };




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

  chainedMappingsXML;

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
      expectVariables(variables, [
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
      expectVariables(variables, [
        {
          name: 'genericTypes',
          type: 'Context',
          info: '',
          entries: [
            { name: 'string', type: 'String', info: 'foo', entries: [] },
            { name: 'number', type: 'Number', info: '1', entries: [] },
            { name: 'boolean', type: 'Boolean', info: 'true', entries: [] },
            { name: 'null', type: 'Null', entries: [] },
          ]
        }
      ]);
    }));

  });


  describe('Merging', function() {

    beforeEach(bootstrap(mergingXML));


    it('should merge multiple variables (if-else)', inject(async function(variableResolver, elementRegistry) {

      // given
      const root = elementRegistry.get('Process_1');

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
      const variables = await variableResolver.getVariablesForElement(root.businessObject);

      // then
      expectVariables(variables, [
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
      expectVariables(variables, [
        ...initialVariables,
        {
          name: 'validMapping',
          type: 'TestVariable',
          info: 'TestInfo'
        },
        {
          name: 'invalidMapping',
          type: 'Null',
          info: ''
        }
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


function shouldTest(value) {
  return typeof value !== 'undefined';
}