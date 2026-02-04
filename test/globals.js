const { use, expect } = require('chai');
const { default: sinonChai } = require('sinon-chai');


function isDefined(value) {
  return typeof value !== 'undefined';
}

function VariableEqual(chai, utils) {

  utils.addMethod(chai.Assertion.prototype, 'variableEqual', function(comparison) {
    var variables = this._obj;
    var expectedVariables = comparison;

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

      isDefined(type) && expect(actualVariable.type).to.eql(type);
      isDefined(info) && expect(actualVariable.info).to.eql(info);
      isDefined(detail) && expect(actualVariable.detail).to.eql(detail);
      isDefined(scope) && expect(actualVariable.scope.id).to.eql(scope);
      isDefined(isList) && expect(!!actualVariable.isList).to.eql(!!isList);
      isDefined(entries) && expect(actualVariable.entries).to.variableEqual(entries);

      isDefined(origin) && expect(actualVariable.origin.length).to.eql(origin.length);
      isDefined(origin) && origin.forEach((expectedOrigin) => {
        const foundOrigin = actualVariable.origin.find(o => o.id === expectedOrigin);
        expect(foundOrigin).to.exist;
      });
    });
  });
}

use(VariableEqual);
use(sinonChai);