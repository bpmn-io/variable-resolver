import { is } from 'bpmn-js/lib/util/ModelUtil';
import { filter } from 'min-dash';

export function hasOutputMappings(element) {
  return !!getOutputParameters(element).length;
}

export function hasInputParameter(element, name) {
  return getInputParameters(element).find(function(input) {
    return (
      input.target === name || // zeebe
      input.name === name // camunda
    );
  });
}

// helpers //////////

function getInputParameters(element) {
  return getParameters(element, 'inputParameters');
}

function getOutputParameters(element) {
  return getParameters(element, 'outputParameters');
}

function getInputOutput(element) {
  return (
    (getExtensionElements(element, 'zeebe:IoMapping'))[0] ||
    (getExtensionElements(element, 'camunda:InputOutput'))[0]
  );
}

function getParameters(element, property) {
  var inputOutput = getInputOutput(element);

  return (inputOutput && inputOutput.get(property)) || [];
}

function getExtensionElements(element, type) {
  var elements = [];
  var extensionElements = element.get('extensionElements');

  if (typeof extensionElements !== 'undefined') {
    var extensionValues = extensionElements.get('values');

    if (typeof extensionValues !== 'undefined') {
      elements = filter(extensionValues, function(value) {
        return is(value, type);
      });
    }
  }

  return elements;
}
