import { getProcessVariables } from '@bpmn-io/extract-process-variables/zeebe';
import { BaseVariableResolver } from '../base/VariableResolver';
import {
  parseVariables,
  getElementNamesToRemove
} from './util/feelUtility';
import {
  getBusinessObject,
  is
} from 'bpmn-js/lib/util/ModelUtil';
import { getInputOutput } from '../base/util/ExtensionElementsUtil';


const HIGH_PRIORITY = 2000;

/**
 * The Camunda 8 Implementation for the VariableResolver.
 */
export default class ZeebeVariableResolver extends BaseVariableResolver {
  constructor(eventBus, bpmnjs) {
    super(eventBus, bpmnjs);
    this._baseExtractor = getProcessVariables;

    eventBus.on('variableResolver.parseVariables', HIGH_PRIORITY, this._resolveVariables);
  }

  async getVariablesForElement(element, moddleElement) {
    const variables = await super.getVariablesForElement(element);

    const bo = getBusinessObject(element);

    if (!moddleElement) {
      return variables;
    }

    const inputOutput = getInputOutput(bo);

    if (!inputOutput) {
      return variables;
    }

    const namesToFilter = getElementNamesToRemove(moddleElement, inputOutput);

    return variables.filter(v => {

      // Keep all variables that are also defined in other elements
      if (v.origin.length > 1 || v.origin[0] !== bo) {
        return true;
      }

      // Keep all variables from external data providers in outputs
      if (
        is(moddleElement, 'zeebe:Output') &&
        v.provider.find(extractor => extractor !== this._baseExtractor)
      ) {
        return true;
      }

      // Filter all pre-defined variables
      return !namesToFilter.includes(v.name);
    });
  }

  /**
   * Parsed the variables and resolves the variable schema to kept the
   * variable schema throughout the process.
   *
   * @param {Event} e
   * @param {Object} context
   * @param {Array<ProcessVariable>} context.variables
   */
  _resolveVariables(e, context) {
    const rawVariables = context.variables;

    const mappedVariables = {};

    for (const key in rawVariables) {
      const variables = rawVariables[key];
      const newVariables = parseVariables(variables);

      mappedVariables[key] = [ ...variables, ...newVariables ];
    }

    context.variables = mappedVariables;
  }
}
