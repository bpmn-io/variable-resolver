import { getProcessVariables } from '@bpmn-io/extract-process-variables';
import { BaseVariableResolver } from './base/VariableResolver';

export class CamundaVariableResolver extends BaseVariableResolver {
  constructor(eventBus, bpmnjs) {
    super(eventBus, bpmnjs);
    this._baseExtractor = getProcessVariables;
  }
}