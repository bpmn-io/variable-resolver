import VariableProvider from '../../VariableProvider';
import { getExtensionElementsList } from '../../base/util/ExtensionElementsUtil';
import { getResultContext, toUnifiedFormat } from '../util/feelUtility';

/**
 * TODO: This method tries to mirror the behavior of ConnectorMappings. However, this is not possible in all cases,
 * as the absence of the header has execution implications. This should be replaced with engine behavior in the
 * Connector Implementation at one point.
 */
class ConnectorVariableProvider extends VariableProvider {
  getVariables(element) {

    const result = [];

    const taskheaders = getExtensionElementsList(element, 'zeebe:TaskHeaders')[0];

    if (!taskheaders || !taskheaders.values) {
      return;
    }

    const headers = taskheaders.values;

    const resultVariable = headers.find(header => {
      return header.key === 'resultVariable';
    });

    const resultExpression = headers.find(header => {
      return header.key === 'resultExpression';
    });

    if (resultVariable && resultVariable.value) {
      result.push({
        name: resultVariable.value
      });
    }

    if (resultExpression && resultExpression.value) {

      // parse with FEEL
      const resultContext = getResultContext(resultExpression.value.substring(1));

      const expressionVariables = toUnifiedFormat(resultContext.computedValue(), result);

      if (expressionVariables && expressionVariables.length > 0) {
        result.push(
          ...expressionVariables[0].entries
        );
      }
    }

    return result;
  }
}

export default ConnectorVariableProvider;