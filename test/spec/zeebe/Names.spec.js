import { expect } from 'chai';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';

import { bootstrapModeler, inject } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

import namesXML from 'test/fixtures/zeebe/mappings/names.bpmn';


describe('ZeebeVariableResolver - Variable Names', function() {

  beforeEach(bootstrapModeler(namesXML, {
    additionalModules: [
      ZeebeVariableResolverModule
    ],
    moddleExtensions: {
      zeebe: ZeebeModdle
    }
  }));


  it('should resolve multi-word name', expectVariable({
    name: 'multiWord',
    entries: [
      { name: 'id', type: 'Number', info: '1' },
      { name: 'state', type: 'String', info: '"open"' }
    ]
  }));


  it('should resolve multi-word name with different spacing', expectVariable({
    name: 'multiWordSpacing',
    entries: [
      { name: 'id', type: 'Number', info: '1' }
    ]
  }));


  it('should resolve name with special characters', expectVariable({
    name: 'specialCharacters',
    entries: [
      { name: 'amount', type: 'Number', info: '10' }
    ]
  }));


  it('should resolve name after name with apostrophe', expectVariable({
    name: 'apostrophe',
    entries: [
      { name: 'name', type: 'String', info: '"Jane"' },
      { name: 'state', type: 'String', info: '"open"' }
    ]
  }));


  it('should resolve multi-word name with tab', expectVariable({
    name: 'multiWordTab',
    entries: [
      { name: 'id', type: 'Number', info: '1' }
    ]
  }));


  it('should resolve name with special characters and spacing', expectVariable({
    name: 'specialCharactersSpacing',
    entries: [
      { name: 'amount', type: 'Number', info: '10' }
    ]
  }));


  it('should resolve name with apostrophe and spacing', expectVariable({
    name: 'apostropheSpacing',
    entries: [
      { name: 'name', type: 'String', info: '"Jane"' }
    ]
  }));


  it('should resolve date-time name', expectVariable({
    name: 'dateTime',
    entries: [
      { name: 'day', type: 'String', info: '"today"' }
    ]
  }));


  it('should resolve date-time function with longer name in scope', expectVariable({
    name: 'dateTimePrefix',
    entries: [
      { name: 'time', type: 'String', info: '"10:00:00"' }
    ]
  }));


  it('should resolve name of keyword', expectVariable({
    name: 'keyword',
    entries: [
      { name: 'x', type: 'String', info: '"yes"' }
    ]
  }));


  it('should resolve name of keyword in keyword position', expectVariable({
    name: 'keywordPosition',
    type: 'String',
    info: '"yes"'
  }));


  it('should resolve name with question mark', expectVariable({
    name: 'questionMark',
    entries: [
      { name: 'value', type: 'String', info: '"question"' }
    ]
  }));


  it('should resolve non-ASCII names', expectVariable({
    name: 'unicode',
    entries: [
      { name: 'a', type: 'Number', info: '180' },
      { name: 'b', type: 'Boolean', info: 'true' },
      { name: 'c', type: 'String', info: '"combining"' },
      { name: 'd', type: 'String', info: '"dot"' }
    ]
  }));


  it('should resolve names with leading and trailing space', expectVariable({
    name: 'spaceAround',
    entries: [
      { name: 'a', type: 'String', info: '"leading"' },
      { name: 'b', type: 'String', info: '"trailing"' }
    ]
  }));


  it('should resolve path', expectVariable({
    name: 'path',
    entries: [
      { name: 'city', type: 'String', info: '"Berlin"' }
    ]
  }));


  it('should resolve context entry shadowing variable', expectVariable({
    name: 'shadowed',
    entries: [
      { name: 'copy', type: 'String', info: '"ten"' },
      { name: 'amount', type: 'Number', info: '10' }
    ]
  }));


  it('should resolve names of different scopes', expectVariable({
    name: 'innerCustomer',
    entries: [
      { name: 'name', type: 'String', info: '"Jane"' },
      { name: 'id', type: 'Number', info: '1' }
    ]
  }));

});


// helpers //////////

function expectVariable(expectedVariable) {
  return inject(async function(variableResolver, elementRegistry) {

    // given
    const root = elementRegistry.get('Process_1');

    // when
    const variables = await variableResolver.getVariablesForElement(root);

    // then
    expect(variables).to.variableInclude(expectedVariable);
  });
}
