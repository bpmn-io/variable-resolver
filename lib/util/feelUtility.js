import { parser, trackVariables, BaseContext } from 'lezer-feel';
import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import {
  ContextTracker,
} from '@lezer/lr';


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

    if (insertBefore === -1) {
      sortedVariables.push({ variable, unresolved });
      return;
    }

    sortedVariables.splice(insertBefore, 0, { variable, unresolved });
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
    const resultContext = getResultContext(variable.expression, rootContext);
    rootContext.entries[variable.name] = resultContext.computedValue();
  });

  const newVariables = toUnifiedFormat(rootContext.entries);

  newVariables.forEach(newVariable => {
    const oldVariable = sortedVariables.find(({ variable }) => variable.name === newVariable.name);

    oldVariable && Object.assign(oldVariable.variable, {
      ...newVariable,
      name: newVariable.name
    });
  });
}


// helpers //////////////////////

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

  const tree = contextualParser.parse(expression);

  console.log('parse tree', tree, latestVariables);

  return latestVariables;
}


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
        type: 'null'
      });
      continue;
    }

    result.push({
      ...variable,
      entries: toUnifiedFormat(variable.entries),
      name: key
    });
  }

  return result;
}


function getExtensionElementsList(businessObject, type = undefined) {
  const extensionElements = businessObject.get('extensionElements');

  if (!extensionElements) {
    return [];
  }

  const values = extensionElements.get('values');

  if (!values || !values.length) {
    return [];
  }

  if (type) {
    return values.filter(value => is(value, type));
  }

  return values;
}

function findUnresolvedVariables(tree) {
  const results = [];

  results.push(...(tree.children.flatMap(findUnresolvedVariables)));

  if (tree.name === 'VariableName' && !tree.value) {
    results.push(tree.raw);
  }

  return results;
}

class EntriesContext extends BaseContext {
  constructor(value = { entries: {} }) {
    super(value);

    this.value.entries = this.value.entries || {};
    for (const key in this.value.entries) {
      const entry = this.value.entries[key];

      if (
        this.isAtomic(entry)
      ) {
        continue;
      }

      this.value.entries[key] = new EntriesContext(this.value.entries[key]);
    }
  }

  getKeys() {
    return Object.keys(this.value.entries);
  }

  get(key) {
    return this.value.entries[key];
  }

  set(key, value) {
    return new EntriesContext(
      {
        ...this.value,
        entries: {
          ...this.value.entries,
          [key]: value
        }
      }
    );
  }

  static merge(...contexts) {
    const merged = contexts.reduce((merged, context) => {
      if (!(context && context.value)) {
        return merged;
      }

      return {
        ...merged,
        ...context.value,
        entries: {
          ...merged.entries,
          ...context.value.entries
        }
      };
    }, {});

    return new EntriesContext(merged);
  }
}