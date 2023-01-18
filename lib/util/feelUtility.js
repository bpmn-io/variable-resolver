import { parser, trackVariables } from 'lezer-feel';


import {
  ContextTracker,
} from '@lezer/lr';
import { EntriesContext } from './VariableContext';
import { getExtensionElementsList } from './ExtensionElementsUtil';
import { getParents } from './scopeUtil';


export function parseIoMappings(variables) {

  const variablesToResolve = [];

  // Step 1 - Parse all io mappings and populate all that don't have references
  // to other variables io-mappings
  variables.forEach(variable => {
    const ioMapping = getExtensionElementsList(variable.origin[0], 'zeebe:IoMapping')[0];

    if (!ioMapping) {
      return;
    }

    let mappings;
    if (variable.origin[0] === variable.scope) {
      mappings = ioMapping.inputParameters;
    } else {
      mappings = ioMapping.outputParameters;
    }

    if (!mappings) {
      return;
    }

    const origin = mappings.find(mapping => mapping.target === variable.name);

    if (!origin || !origin.source) {
      return;
    }

    variable.expression = origin.source.substring(1);

    const result = getResultContext(variable.expression);

    const unresolved = findUnresolvedVariables(result) ;

    variablesToResolve.push({ variable, unresolved });
  });

  // Step 2 - Order all Variables and resolve them
  resolveReferences(variablesToResolve, variables);

  return variables;
}

function resolveReferences(variablesToResolve, allVariables) {
  const sortedVariables = [];

  // Step 2.1 - Try to order Variables that rely on each other
  variablesToResolve.forEach(({ variable, unresolved }) => {
    const insertBefore = sortedVariables.findIndex(({ unresolved: u }) => {
      return u.includes(variable.name);
    });

    // Insert directly before the first variable that depends on this one
    if (insertBefore > -1) {
      sortedVariables.splice(insertBefore, 0, { variable, unresolved });
      return;
    }

    // Insert directly after the last variable that this one depends on
    // this ensures that later downstream variables are behind this one
    const insertAfter = sortedVariables.findLastIndex(({ variable: v }) => {
      return unresolved.includes(v.name);
    });

    if (insertAfter > -1) {
      sortedVariables.splice(insertAfter + 1, 0, { variable, unresolved });
      return;
    }

    sortedVariables.push({ variable, unresolved });
  });

  const resolvedVariables = allVariables.filter(v =>
    !variablesToResolve.find(({ variable: unresolved }) => {
      v === unresolved;
    })
  );

  const rootContext = {
    name: 'OuterContext',
    entries: toOptimizedFormat(resolvedVariables)
  };

  // Step 2.2 - parse in order, building up the context with resolved variable values
  // This will resolve all variables that don't have circular dependencies on each other
  sortedVariables.forEach(({ variable }) => {
    const resultContext = getResultContext(variable.expression, filterForScope(rootContext, variable));

    let computedResult = resultContext.computedValue();

    // Wrap primitive values in an EntriesContext
    if (!(computedResult instanceof EntriesContext)) {
      computedResult = new EntriesContext(computedResult);
    }

    // Ensure we don't copy the scope from the mapped variable
    computedResult.scope = variable.scope;

    rootContext.entries[variable.name] = computedResult;
  });

  const newVariables = toUnifiedFormat(rootContext.entries);

  newVariables.forEach(newVariable => {
    const oldVariable = sortedVariables.find(({ variable }) => variable.name === newVariable.name);

    oldVariable && Object.assign(oldVariable.variable, {
      ...newVariable,
      name: newVariable.name,
      scope: oldVariable.variable.scope
    });
  });
}


// helpers //////////////////////

/**
 * Parses the expression with the given variables and return the result context
 *
 * @param {String} expression
 * @param {Variables} variables
 * @returns {EntriesContext}
 */
function getResultContext(expression, variables = {}) {
  const contextTracker = trackVariables(variables, EntriesContext);

  // This is a hack to get the latest variables from the context tracker
  // lezer does not automatically annotate the parse tree with the context
  let latestVariables = null;

  const customContextTracker = new ContextTracker({
    start: contextTracker.start,
    reduce(...args) {
      const result = contextTracker.reduce(...args);
      latestVariables = result;
      return result;
    }
  });

  const contextualParser = parser.configure({
    contextTracker: customContextTracker
  });

  contextualParser.parse(expression);

  return latestVariables;
}

/**
 * Traverses the parseTree and returns all `VariableName` nodes with no value
 *
 * @param {Object} node
 * @returns {Array<String>}
 */
function findUnresolvedVariables(node) {
  const results = [];

  results.push(...(node.children.flatMap(findUnresolvedVariables)));

  if (node.name === 'VariableName' && !node.value) {
    results.push(node.raw);
  }

  return results;
}


/**
 * Transforms the entries of a variable from an array to an object.
 * This allows faster lookup times during parsing.
 *
 * [{ name, entries: [] }]
 * to
 * {name: { name, entries: {} }}
 */
function toOptimizedFormat(variables) {

  if (!variables) {
    return;
  }

  const result = {};

  variables.forEach(variable => {
    result[variable.name] = { ...variable };
    result[variable.name].entries = toOptimizedFormat(variable.entries);
  });

  return result;
}

/**
 * Transforms EntriesContext to the format required by the feel-editor
 */
function toUnifiedFormat(variables) {

  if (!variables) {
    return;
  }

  const result = [];

  for (const key in variables) {
    let variable = variables[key];

    if (variable instanceof EntriesContext) {
      variable = variable.value;
    }

    if (!variable) {
      result.push({
        name: key,
        type: 'Null'
      });
      continue;
    }

    result.push({
      ...annotate(variable),
      entries: toUnifiedFormat(variable.entries),
      name: key,
      scope: variable.scope
    });
  }

  return result;
}


function annotate(variable) {
  return {
    ...variable,
    type: getType(variable),
    info: getInfo(variable)
  };

}

function getType(variable) {

  if (!variable) {
    return '';
  }

  if (variable.type) {
    return variable.type;
  }

  if (variable.entries && Object.keys(variable.entries).length) {
    return 'Context';
  }

  if (variable.atomicValue) {
    return capitalize(typeof variable.atomicValue);
  }

  if (variable.atomicValue === null) {
    return 'Null';
  }

  return '';
}

function getInfo(variable) {
  if (!variable) {
    return '';
  }

  if (variable.info) {
    return variable.info;
  }

  if (variable.atomicValue) {
    return '' + variable.atomicValue;
  }

  return '';
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function filterForScope(context, variable) {
  const scopedResults = {
    entries: {}
  };

  const validScopes = variable.origin.flatMap(bo => {
    return [ bo, ...getParents(bo) ];
  });

  for (const key in context.entries) {
    const entry = context.entries[key];

    if (validScopes.find(scope => scope.id === entry.scope.id)) {
      scopedResults.entries[key] = entry;
    }
  }

  return scopedResults;
}