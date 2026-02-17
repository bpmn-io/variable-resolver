const { use, expect } = require('chai');
const { default: sinonChai } = require('sinon-chai');


function isDefined(value) {
  return typeof value !== 'undefined';
}

function VariableEqual(chai, utils) {

  utils.addMethod(chai.Assertion.prototype, 'variableEqual', function(comparison) {
    var variables = this._obj;
    var expectedVariables = comparison;

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

      const actualVariable = variables.find(
        v => (!isDefined(name) || v.name === name) && (!isDefined(scope) || v.scope?.id === scope)
      );

      expect(actualVariable, `variable[name=${name}, scope=${scope}]`).to.exist;

      isDefined(type) && expect(actualVariable.type, `variable[name=${name}].type`).to.eql(type);
      isDefined(info) && expect(actualVariable.info, `variable[name=${name}].info`).to.eql(info);
      isDefined(detail) && expect(actualVariable.detail, `variable[name=${name}].detail`).to.eql(detail);
      isDefined(scope) && expect(actualVariable.scope.id, `variable[name=${name}].scope.id`).to.eql(scope);
      isDefined(isList) && expect(!!actualVariable.isList, `variable[name=${name}].isList`).to.eql(!!isList);
      isDefined(entries) && expect(actualVariable.entries, `variable[name=${name}].entries`).to.variableEqual(entries);

      isDefined(origin) && origin.forEach((expectedOrigin) => {
        const foundOrigin = actualVariable.origin.find(o => o.id === expectedOrigin);
        expect(foundOrigin, `origin[name=${expectedOrigin}]`).to.exist;
      });

      isDefined(origin) && expect(actualVariable.origin.length, `variable[name=${name}].origin.length`).to.eql(origin.length);
    });

    expect(variables.length, 'variables.length').to.eql(expectedVariables.length);
  });
}

use(VariableEqual);
use(sinonChai);