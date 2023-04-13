import { CamundaVariableResolver } from './CamundaVariableResolver';
import { ZeebeVariableResolver } from './ZeebeVariableResolver';
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