import { getProcessVariables } from '@bpmn-io/extract-process-variables/zeebe';
import { BaseVariableResolver } from './base/VariableResolver';

export class ZeebeVariableResolver extends BaseVariableResolver {
  constructor(eventBus, bpmnjs) {
    super(eventBus, bpmnjs);
    this._baseExtractor = getProcessVariables;
  }
}