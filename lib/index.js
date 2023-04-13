import CamundaVariableResolver from './camunda/VariableResolver';
import ZeebeVariableResolver from './zeebe/VariableResolver';
import VariableProvider from './VariableProvider';

export const ZeebeVariableResolverModule = {
  __init__: [
    'variableResolver',
  ],
  variableResolver: [ 'type', ZeebeVariableResolver ],
};

export const CamundaVariableResolverModule = {
  __init__: [
    'variableResolver',
  ],
  variableResolver: [ 'type', CamundaVariableResolver ],
};

export { VariableProvider };