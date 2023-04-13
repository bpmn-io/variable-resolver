import { getExtensionElementsList } from '../../base/util/ExtensionElementsUtil';
import { getResultContext, toUnifiedFormat } from '../util/feelUtility';

/**
 * TODO: This method tries to mirror the behavior of ConnectorMappings. However, this is not possible in all cases,
 * as the absence of the header has execution implications. This should be replaced with engine behavior in the
 * Connector Implementation at one point.
 */
const ConnectorVariableProvider = {
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

    if (resultExpression) {

      // parse with FEEL
      const resultContext = getResultContext(resultExpression.value.substring(1));

      const allVariables = toUnifiedFormat(resultContext.computedValue(), result);

      result.push(
        ...allVariables[0].entries
      );
    }

    return result;
  }
};


export default ConnectorVariableProvider;