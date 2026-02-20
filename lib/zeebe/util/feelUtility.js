import { parser, trackVariables } from '@bpmn-io/lezer-feel';
import {
  ContextTracker,
} from '@lezer/lr';

import { isNil } from 'min-dash';
import { FeelAnalyzer } from '@bpmn-io/feel-analyzer';

import { EntriesContext } from './VariableContext';
import { getExtensionElementsList } from '../../base/util/ExtensionElementsUtil';
import { getParents } from '../../base/util/scopeUtil';
import { mergeEntries } from '../../base/VariableResolver';
import { is } from 'bpmn-js/lib/util/ModelUtil';
import { camundaBuiltins, camundaReservedNameBuiltins } from '@camunda/feel-builtins';

const feelAnalyzer = new FeelAnalyzer({
  dialect: 'expression',
  parserDialect: 'camunda',
  builtins: camundaBuiltins,
  reservedNameBuiltins: camundaReservedNameBuiltins
});

export function parseVariables(variables) {

  const variablesToResolve = [];
  const analysisResults = [];

  // Step 1 - Parse all variables and populate all that don't have references
  // to other variables
  variables.forEach(variable => {
    variable.origin.forEach(origin => {
      const expressionDetails = getExpressionDetails(variable, origin);

      if (!expressionDetails) {
        return;
      }

      const {
        expression,
        unresolved,
        requirementAnalyses
      } = expressionDetails;

      variablesToResolve.push({ variable, expression, unresolved });

      // Collect analyses for input requirement extraction
      for (const { expressionType, inputs } of requirementAnalyses) {
        analysisResults.push({
          origin,
          targetName: variable.name,
          inputs,
          expressionType
        });
      }
    });
  });

  // Step 2 - Order all Variables and resolve them
  const resolvedVariables = resolveReferences(variablesToResolve, variables);

  // Step 3 - Build input requirements from collected analyses
  const inputRequirements = buildInputRequirements(analysisResults);

  return { resolvedVariables, inputRequirements };
}

function resolveReferences(variablesToResolve, allVariables) {
  const sortedVariables = [];

  // Step 2.1 - Try to order Variables that rely on each other
  variablesToResolve.forEach((details) => {
    const { variable, unresolved } = details;
    const insertBefore = sortedVariables.findIndex(({ unresolved: u }) => {
      return u.includes(variable.name);
    });

    // Insert directly before the first variable that depends on this one
    if (insertBefore > -1) {
      sortedVariables.splice(insertBefore, 0, details);
      return;
    }

    // Insert directly after the last variable that this one depends on
    // this ensures that later downstream variables are behind this one
    const insertAfter = sortedVariables.findLastIndex(({ variable: v }) => {
      return unresolved.includes(v.name);
    });

    if (insertAfter > -1) {
      sortedVariables.splice(insertAfter + 1, 0, details);
      return;
    }

    sortedVariables.push(details);
  });

  const variablesWithoutMappings = allVariables.filter(v =>
    !variablesToResolve.find(({ variable: unresolved }) => {
      v === unresolved;
    })
  );

  const rootContext = {
    name: 'OuterContext',
    entries: toOptimizedFormat(variablesWithoutMappings.filter(v => v.scope))
  };

  const newVariables = [];

  // Step 2.2 - parse in order, building up the context with resolved variable values
  // This will resolve all variables that don't have circular dependencies on each other
  sortedVariables.forEach(({ variable, expression }) => {
    const resultContext = getResultContext(expression, filterForScope(rootContext, variable));

    let computedResult = resultContext.computedValue();

    // Wrap primitive values in an EntriesContext
    if (!(computedResult instanceof EntriesContext)) {
      computedResult = EntriesContext.of(computedResult);
    }

    // Ensure we don't copy the scope from the mapped variable
    computedResult.scope = variable.scope;

    rootContext.entries[variable.name] = computedResult;

    newVariables.push({
      newVariable: toUnifiedFormat({
        [variable.name]: computedResult
      })[0],
      oldVariable: variable
    });
  });

  // Ensure meta-data (scope, origin) is kept from original variable
  const result = newVariables.map(({ newVariable, oldVariable }) => {
    if (oldVariable) {
      return {
        ...newVariable,
        ...oldVariable
      };
    }
    return newVariable;
  });

  return result;
}


// helpers //////////////////////

/**
 * Parses the expression with the given variables and return the result context
 *
 * @param {String} expression
 * @param {Variables} variables
 * @returns {EntriesContext}
 */
export function getResultContext(expression, variables = {}) {
  const contextTracker = trackVariables(variables, EntriesContext);

  // This is a hack to get the latest variables from the context tracker
  // lezer does not automatically annotate the parse tree with the context
  let latestVariables = contextTracker.start;

  const customContextTracker = new ContextTracker({
    start: contextTracker.start,
    reduce(...args) {
      const result = contextTracker.reduce(...args);
      latestVariables = result;
      return result;
    }
  });

  const contextualParser = parser.configure({
    contextTracker: customContextTracker,
    strict: true
  });

  try {
    contextualParser.parse(expression);
  } catch (error) {

    // bail out in case of an error
    return latestVariables;
  }

  return latestVariables;
}

/**
 * Find all matching expression sources for a variable on a given origin element.
 *
 * Returns candidates ordered by resolution priority (first = highest).
 * Local variables: script > input-mapping (script result overwrites at runtime).
 * Global variables: output-mapping > script.
 *
 * @param {ProcessVariable} variable
 * @param {djs.model.Base} origin
 * @returns {Array<{ type: string, value: string }>}
 */
function findExpressions(variable, origin) {
  const isLocal = variable.scope === origin;

  const candidates = isLocal
    ? [
      { type: 'script', value: getScriptExpression(variable, origin) },
      { type: 'input-mapping', value: getIoInputExpression(variable, origin) },
    ]
    : [
      { type: 'output-mapping', value: getIoOutputExpression(variable, origin) },
      { type: 'script', value: getScriptExpression(variable, origin) },
    ];

  return candidates.filter(c => c.value);
}

/**
 * Given a Variable and a specific origin, return the mapping expression and all
 * unresolved variables used in that expression. Returns undefined if no mapping
 * exists for the given origin.
 *
 * The primary (highest-priority) expression is used for variable resolution.
 * All non-output-mapping expressions are analyzed for input requirements,
 * since a variable may be produced by both a script and an input mapping.
 *
 * @param {ProcessVariable} variable
 * @param {djs.model.Base} origin
 * @returns {{ expression: String, unresolved: Array<String>, requirementAnalyses: Array, expressionType: String }}
 */
function getExpressionDetails(variable, origin) {

  const matches = findExpressions(variable, origin);

  if (matches.length === 0) {
    return;
  }

  // Primary expression for variable resolution (highest priority)
  const { value: expression, type: expressionType } = matches[0];

  const result = getResultContext(expression);
  const unresolved = findUnresolvedVariables(result);

  // Analyze each non-output-mapping expression for input requirements
  const requirementAnalyses = [];

  for (const { type, value } of matches) {
    if (type === 'output-mapping') {
      continue;
    }

    try {
      const analysisResult = feelAnalyzer.analyzeExpression(`=${value}`);

      if (analysisResult.valid !== false && analysisResult.inputs && analysisResult.inputs.length > 0) {
        requirementAnalyses.push({
          expressionType: type,
          inputs: analysisResult.inputs
        });
      }
    } catch (error) {
      console.warn(`Failed to analyze expression for variable ${variable.name}:`, error);
    }
  }

  return { expression, unresolved, requirementAnalyses, expressionType };
}

/**
 * Given a variable and origin, return input mapping expression targeting the variable.
 *
 * @param {ProcessVariable} variable
 * @param {djs.model.Base} origin
 * @returns {string|undefined}
 */
function getIoInputExpression(variable, origin) {
  return getIoExpressionByType(variable, origin, 'input');
}

/**
 * Given a variable and origin, return output mapping expression targeting the variable.
 *
 * @param {ProcessVariable} variable
 * @param {djs.model.Base} origin
 * @returns {string|undefined}
 */
function getIoOutputExpression(variable, origin) {
  return getIoExpressionByType(variable, origin, 'output');
}

/**
 * Given a variable and origin, return mapping expression by mapping type.
 *
 * @param {ProcessVariable} variable
 * @param {djs.model.Base} origin
 * @param {'input'|'output'} mappingType
 * @returns {string|undefined}
 */
function getIoExpressionByType(variable, origin, mappingType) {
  const ioMapping = getExtensionElementsList(origin, 'zeebe:IoMapping')[0];

  if (!ioMapping) {
    return;
  }

  const mappings = mappingType === 'input'
    ? ioMapping.inputParameters
    : ioMapping.outputParameters;

  if (!mappings) {
    return;
  }

  const mapping = mappings.slice().reverse().find(mapping => mapping.target === variable.name);

  if (!mapping || !mapping.source || !mapping.source.startsWith('=')) {
    return;
  }

  return mapping.source.substring(1);
}

/**
 * Given a Variable and a specific origin, return the mapping expression for script
 * task result variable. Returns undefined if no mapping exists for the given origin.
 *
 * @param {ProcessVariable} variable
 * @param {djs.model.Base} origin
 * @returns {string}
 */
function getScriptExpression(variable, origin) {
  const script = getExtensionElementsList(origin, 'zeebe:Script')[0];

  if (!script || !script.expression) {
    return;
  }

  if (script.resultVariable === variable.name) {
    return script.expression.substring(1);
  }
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
 * [ { name, entries: [] } ]
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
export function toUnifiedFormat(variables) {
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
        name: key
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

  if (!isNil(variable.atomicValue)) {
    return capitalize(typeof variable.atomicValue);
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

  if (!isNil(variable.atomicValue)) {
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

    if (entry.scope && validScopes.find(scope => scope.id === entry.scope.id)) {
      scopedResults.entries[key] = entry;
    }
  }

  return scopedResults;
}

/**
 * Remove input/output element name after current definition
 */
export function getElementNamesToRemove(moddleElement, inputOutput) {
  const namesToFilter = [];

  // Input: remove all inputs defined after the current input definition
  if (is(moddleElement, 'zeebe:Input')) {
    const allInputs = inputOutput.inputParameters;

    const inputsToFilter =
        allInputs
          .slice(allInputs.indexOf(moddleElement))
          .map(o => o.target);

    namesToFilter.push(...inputsToFilter);
  }

  const allOutputs = inputOutput.outputParameters;

  // Output: remove all outputs defined after the current output definition
  if (is(moddleElement, 'zeebe:Output')) {

    // Get all output mappings defined after the current element, including own name
    const outputsToFilter = allOutputs
      .slice(allOutputs.indexOf(moddleElement))
      .map(o => o.target);

    namesToFilter.push(...outputsToFilter);
  }

  // Input or general property: remove all outputs
  else if (allOutputs) {

    // Input or execution-related element, remove all outputs
    const outputsToFilter = allOutputs
      .map(o => o.target);

    namesToFilter.push(...outputsToFilter);
  }

  return namesToFilter;
}

/**
 * Build input requirement variables from pre-collected analysis results.
 *
 * @param {Array<{ origin: Object, targetName: String, inputs: Array, expressionType: String }>} analysisResults
 * @returns {Array<ProcessVariable>} input requirements
 */
function buildInputRequirements(analysisResults) {
  const inputRequirements = {};
  const inputMappingTargetsCache = {};

  for (const { origin, targetName, inputs, expressionType } of analysisResults) {

    if (!inputMappingTargetsCache[origin.id]) {
      inputMappingTargetsCache[origin.id] = getInputMappingTargetNames(origin);
    }
    const orderedTargets = inputMappingTargetsCache[origin.id];

    // Input mappings are order-sensitive: only earlier targets are available.
    // Scripts can reference all input mapping targets.
    let availableLocalTargets;
    if (expressionType === 'input-mapping') {
      const targetIndex = orderedTargets.indexOf(targetName);
      availableLocalTargets = new Set(orderedTargets.slice(0, targetIndex));
    } else {
      availableLocalTargets = new Set(orderedTargets);
    }

    for (const inputVar of inputs) {

      // Skip variables that are provided by input mappings on the same element
      if (availableLocalTargets.has(inputVar.name)) {
        continue;
      }

      const key = `${inputVar.name}__${origin.id}`;

      if (!inputRequirements[key]) {
        inputRequirements[key] = {
          name: inputVar.name,
          origin: [ origin ],
          entries: inputVar.entries || [],
          usedBy: [ targetName ],
          provider: [],
        };
      } else {
        if (!inputRequirements[key].usedBy.includes(targetName)) {
          inputRequirements[key].usedBy.push(targetName);
        }

        // Merge entries from the new input into the existing requirement
        // e.g. `a.b` and `a.c` should result in `a: {b, c}`
        if (inputVar.entries && inputVar.entries.length) {
          mergeEntries(inputRequirements[key], { entries: inputVar.entries });
        }
      }
    }
  }

  return Object.values(inputRequirements);
}

/**
 * Get ordered input mapping target names for an element.
 *
 * @param {djs.model.Base} origin
 * @returns {Array<String>}
 */
function getInputMappingTargetNames(origin) {
  const ioMapping = getExtensionElementsList(origin, 'zeebe:IoMapping')[0];
  if (!ioMapping || !ioMapping.inputParameters) return [];
  return ioMapping.inputParameters.map(p => p.target);
}


