import { getProcessVariables } from '@bpmn-io/extract-process-variables/zeebe';
import { BaseVariableResolver } from '../base/VariableResolver';
import { parseIoMappings } from './util/feelUtility';
import ConnectorVariableProvider from './extractors/connectors';

const HIGH_PRIORITY = 2000;

/**
 * The Camunda 8 Implementation for the VariableResolver.
 */
export default class ZeebeVariableResolver extends BaseVariableResolver {
  constructor(eventBus, bpmnjs) {
    super(eventBus, bpmnjs);
    this._baseExtractor = getProcessVariables;

    eventBus.on('variableResolver.parseVariables', HIGH_PRIORITY, this._resolveIoMappings);
    this.registerProvider(ConnectorVariableProvider);
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
