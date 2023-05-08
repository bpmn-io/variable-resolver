import { getProcessVariables } from '@bpmn-io/extract-process-variables/zeebe';
import { BaseVariableResolver } from '../base/VariableResolver';
import { parseIoMappings } from './util/feelUtility';
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

    eventBus.on('variableResolver.parseVariables', HIGH_PRIORITY, this._resolveIoMappings);
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

    const namesToFilter = [];

    // Input: remove all inputs defined after the current input definition
    if (is(moddleElement, 'zeebe:Input')) {
      const allInputs = inputOutput.inputParameters;

      const inputsToFilter =
        allInputs
          .slice(allInputs.indexOf(moddleElement))
          .map(o => o.target);

      namesToFilter.push(...inputsToFilter);
    }

    const allOutputs = inputOutput.outputParameters;

    // Output: remove all outputs defined after the current output definition
    if (is(moddleElement, 'zeebe:Output')) {

      // Get all output mappings defined after the current element, including own name
      const outputsToFilter = allOutputs
        .slice(allOutputs.indexOf(moddleElement))
        .map(o => o.target);

      namesToFilter.push(...outputsToFilter);
    }

    // Input or general property: remove all outputs
    else if (allOutputs) {

      // Input or execution-related element, remove all outputs
      const outputsToFilter = allOutputs
        .map(o => o.target);

      namesToFilter.push(...outputsToFilter);
    }

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
   * Parsed the variables that have io-mappings and resolves the variable schema to kept the
   * variable schema throughout the process.
   *
   * @param {Event} e
   * @param {Object} context
   * @param {Array<ProcessVariable>} context.variables
   */
  _resolveIoMappings(e, context) {
    const rawVariables = context.variables;

    const mappedVariables = {};

    for (const key in rawVariables) {
      const variables = rawVariables[key];
      const newVariables = parseIoMappings(variables);

      mappedVariables[key] = [ ...variables, ...newVariables ];
    }

    context.variables = mappedVariables;
  }
}
