import { parser, trackVariables } from 'lezer-feel';
import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import {
  evaluate,
} from 'feelin';

import {
  ContextTracker,
} from '@lezer/lr';


// function evaluate(expression, context = {}) {

// const {
//   root,
//   parseTree
// } = interpreter.evaluate(expression, context);

// console.log(root, parseTree);

// // root = [ fn(ctx) ]

// parseTree.iterate({
//   enter(nodeRef) {
//     console.log(nodeRef);
//   }
// });

// const results = root(context);

// if (results.length === 1) {
//   return results[0];
// } else {
//   return results;
// }
// }

export function parseIoMappings(variables) {

  const variablesToResolve = [];

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


    // const {

    // }
    //   = evaluate(origin.source.substring(1));


    const contextTracker = trackVariables({});


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

    // console.log('parsed', , contextTracker);

    // console.log('latestVariables', latestVariables);

    contextualParser.parse(variable.expression);

    const unresolved = findUnresolvedVariables(latestVariables);

    variablesToResolve.push({ variable, unresolved });
    console.log(unresolved);

  });

  resolveReferences(variablesToResolve);

  return variables;
}

function findUnresolvedVariables(tree) {
  const results = [];

  results.push(...(tree.children.flatMap(findUnresolvedVariables)));

  if (tree.name === 'VariableName' && !tree.value) {
    results.push(tree.raw);
  }

  return results;
}

function resolveReferences(variablesToResolve) {

  const sortedVariables = [];

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

  const context = sortedVariables.map(({ variable }) => {
    return `${variable.name}: ${variable.expression}`;
  }).join(',\n');

  const contextTracker = trackVariables({});

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

  // console.log('parsed', , contextTracker);

  // console.log('latestVariables', latestVariables);

  const result = contextualParser.parse(`{${context}}`);

  console.log(result, latestVariables);

  const contextResult = latestVariables.children[0].value;

  for (const key in contextResult) {
    const variable = sortedVariables.find(({ variable }) => variable.name === key);

    toUnifiedFormat(variable.variable, contextResult[key]);

    // variable.variable.entries = contextResult[key];
  }

}

function toUnifiedFormat(variable, context) {
  variable.type = typeof context;

  if (variable.type === 'object') {
    variable.type = 'context';
    variable.entries = toVariables(context);
  }
}

function toVariables(object) {
  const variables = [];
  for (const key in object) {
    const value = object[key];

    const newVariable = {
      name: key,
    };

    toUnifiedFormat(newVariable, value);
    variables.push(newVariable);
  }

  return variables;
}

// export function resolveReferences(variables) {

//   // Fix basic unresolved variable types
//   const missingVariables = variables.filter(variable => variable.entries && variable.entries.type === 'variable');
//   const pathExpression = variables.filter(variable => variable.entries && variable.entries.type === 'PathExpression');

//   missingVariables.forEach(variable => {
//     const expression = variable.entries.value;

//     const resolved = variables.find(v => v.name === expression);

//     if (resolved) {
//       variable.entries = resolved.entries;
//     }
//   });

//   function resolvePathExpression(pathExpr) {
//     let context = pathExpr.children[0];
//     const key = pathExpr.children[1];

//     if (context && context.name === 'VariableName') {
//       const res = variables.find(v => v.name === sanitizeKey(context.content));
//       if (res) {
//         context = res.entries.entry;
//       }
//     }

//     if (context && context.name === 'PathExpression') {
//       context = resolvePathExpression(context);
//     }

//     if (!context) {
//       return null;
//     }

//     return context.children.find(contextEntry => {
//       return sanitizeKey(contextEntry.children[0].content) === sanitizeKey(key.content);
//     });
//   }

//   pathExpression.forEach(pathExpr => {
//     const res = resolvePathExpression(pathExpr.entries.entry);

//     if (!res) {
//       return;
//     }

//     if (res.name === 'ContextEntry') {
//       pathExpr.entries = handleContextEntry(res);
//     }
//   });

//   return variables;
// }

function sanitizeKey(key) {
  if (key.startsWith('"')) {
    key = key.substring(1, key.length - 1);
  }

  return key;
}

// translate AST to get typed Variables
function handleContextEntry(entry) {

  const key = entry.children[0];
  const value = entry.children[1];

  const type = getType(value.name);
  let info;

  if (type !== 'Context') {
    info = `Example: ${value.content}`;
  }


  let name = key.content;
  if (name.startsWith('"')) {
    name = name.substring(1, name.length - 1);
  }

  return {
    name: name,
    type: type,
    values: handleContextValue(value),
    info: info,
    value: value.content,
    entry: value
  };
}

function handleContextValue(value) {
  if (value.name === 'Context') {
    return value.children.map(handleContextEntry) ;
  }

  return [
    {
      type: getType(value.name),
      value: value.content,
      entry: value
    }
  ];
}

function getVariablesFromString(parseableExp) {
  const variables = [];
  const rootContext = getRootContext(parseableExp);

  if (!rootContext || rootContext.name !== 'Context') {
    return variables;
  }

  rootContext.children.forEach(entry => {
    variables.push(handleContextEntry(entry));
  });

  return variables;
}

function getRootContext(exp) {
  const tree = parser.parse(exp);

  const stack = [
    {
      children: []
    }
  ];

  tree.iterate({
    enter(node) {

      const {
        name,
        from,
        to
      } = node;


      const skip = (
        (name === exp.slice(from, to) && name !== 'null')
            || name === 'Identifier'
      );

      const _node = {
        name,
        from,
        to,
        children: [],
        skip,
        content: exp.slice(from, to)
      };

      stack.push({
        ..._node
      });

    },

    leave(node) {
      const current = stack.pop();

      if (current.skip) {
        return;
      }

      const parent = stack[stack.length - 1];

      parent.children.push(current);
    }
  });

  return stack[0].children[0].children[0]; // root=>expression=>context
}

function getType(type) {
  const name = type.replace('Literal', '');

  switch (name) {
  case 'Numeric':
    return 'Number';
  case 'VariableName':
    return 'Variable';
  default:
    return name;
  }
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