import { CamundaVariableResolver } from './CamundaVariableResolver';
import { ZeebeVariableResolver } from './ZeebeVariableResolver';

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