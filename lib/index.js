import CamundaVariableResolver from './camunda/VariableResolver';
import ZeebeVariableResolver from './zeebe/VariableResolver';
import VariableProvider from './VariableProvider';
import ConnectorVariableProvider from './zeebe/extractors/connectors';

export const ZeebeVariableResolverModule = {
  __init__: [
    'variableResolver',
    'connectorVariableProvider'
  ],
  variableResolver: [ 'type', ZeebeVariableResolver ],
  connectorVariableProvider: [ 'type', ConnectorVariableProvider ]
};

export const CamundaVariableResolverModule = {
  __init__: [
    'variableResolver',
  ],
  variableResolver: [ 'type', CamundaVariableResolver ],
};

export { VariableProvider };