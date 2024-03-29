import { is } from 'bpmn-js/lib/util/ModelUtil';
import { hasInputParameter, hasOutputMappings } from './ExtensionElementsUtil';

export function getScope(element, globalScope, variableName) {
  var parents = getParents(element);

  if (hasOutputMappings(element)) {
    return element;
  }

  var scopedParent = parents.find(function(parent) {
    return (
      is(parent, 'bpmn:SubProcess') && hasInputParameter(parent, variableName)
    );
  });

  return scopedParent ? scopedParent : globalScope;
}

export function getParents(element) {
  var parents = [];
  var current = element;

  while (current.$parent) {
    parents.push(current.$parent);
    current = current.$parent;
  }

  return parents;
}