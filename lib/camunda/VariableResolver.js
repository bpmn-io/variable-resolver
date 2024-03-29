import { getProcessVariables } from '@bpmn-io/extract-process-variables';
import { BaseVariableResolver } from '../base/VariableResolver';

/**
 * The Camunda 7 Implementation for the VariableResolver.
 */
export default class CamundaVariableResolver extends BaseVariableResolver {
  constructor(eventBus, bpmnjs) {
    super(eventBus, bpmnjs);
    this._baseExtractor = getProcessVariables;
  }
}