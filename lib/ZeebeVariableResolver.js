import { getProcessVariables } from '@bpmn-io/extract-process-variables/zeebe';
import { BaseVariableResolver } from './base/VariableResolver';
import { parseIoMappings } from './util/feelUtility';

const HIGH_PRIORITY = 2000;

export class ZeebeVariableResolver extends BaseVariableResolver {
  constructor(eventBus, bpmnjs) {
    super(eventBus, bpmnjs);
    this._baseExtractor = getProcessVariables;

    eventBus.on('variableResolver.parseVariables', (e, context) => {
      const rawVariables = context.variables;

      const mappedVariables = {};

      for (const key in rawVariables) {
        const variables = rawVariables[key];
        mappedVariables[key] = parseIoMappings(variables);
      }

      context.variables = mappedVariables;
    }, HIGH_PRIORITY);
  }
}
