import { getProcessVariables } from '@bpmn-io/extract-process-variables/zeebe';
import { BaseVariableResolver } from './base/VariableResolver';
import { parseIoMappings } from './util/feelUtility';

export class ZeebeVariableResolver extends BaseVariableResolver {
  constructor(eventBus, bpmnjs) {
    super(eventBus, bpmnjs);
    this._baseExtractor = getProcessVariables;
  }

  async _parseVariables() {
    const rawVariables = await this.getRawVariables();

    for (const key in rawVariables) {
      const variables = rawVariables[key];
      parseIoMappings(variables);
    }

    return super._parseVariables();
  }
}