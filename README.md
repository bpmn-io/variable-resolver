# @bpmn-io/variable-resolver

[![CI](https://github.com/bpmn-io/variable-resolver/actions/workflows/CI.yml/badge.svg)](https://github.com/bpmn-io/variable-resolver/actions/workflows/CI.yml)

A bpmn-js extension to add and manage additional variable extractors in bpmn diagrams.

## Usage

To add the variable resolver to you application, add it to your bpmn-js configuration:

```javascript
import BpmnModeler from 'bpmn-js/lib/Modeler';
import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import {
  ZeebeVariableResolverModule,     // For Camunda 8 diagrams
  // CamundaVariableResolverModule // for Camunda 7 diagrams
} from '@bpmn-io/variable-resolver';

const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [
    ZeebeVariableResolverModule
  ],
  moddleExtensions = {
    zeebe: ZeebeModdle
  }
});
```

### Retrieving variables

To retrieve the variables from a diagram, use one of the following methods of the `variableResolver` service:

```javascript
const elementRegistry = modeler.get('elementRegistry');
const variableResolver = modeler.get('variableResolver');

const task = elementRegistry.get('Task_1');
const process = elementRegistry.get('Process_1');

await variableResolver.getVariablesForElement(task); // returns variables in the scope of the element
await variableResolver.getProcessVariables(process); // returns all variables for the process, not filtering by scope
```

### Adding a variable extractor

To add your own variables, extend the `variableProvider` class in your extension. It only needs to implement the `getVariables` method, which takes an element as an argument and returns an array of variables you want to add to the scope of the element. The function can be asynchronous.

```javascript
// MyExtension.js
import VariableProvider from '@bpmn-io/variable-resolver/lib/VariableProvider';

class MyCustomProvider extends VariableProvider {
  getVariables(element) {
    const variables = [
      {
        name: 'myVariable',
        type: 'String',
        info: 'This is a global variable'
      }
    ];
      if (is(element, 'bpmn:Process')) {
      return variables;
    }
  }
}

export const MyExtension = {
  __init__: [
    'myCustomProvider',
  ],
  myCustomProvider: [ 'type', MyCustomProvider ],
};
```

### Advanced use-cases

By default, `getVariablesForElement` and `getProcessVariables` will attempt to merge variables with the same name and scope into
one. Entry structure and types are then mixed.

In some cases, you might want access to the raw data, e.g. to run lint rules to detect potential schema mismatches between providers.
For this, you can use

```javascript
const variableResolver = modeler.get('variableResolver');

const raw = await variableResolver.getRawVariables();

/**
 * raw = {
 *  'Process_1': [
 *    {
 *     name: 'myVariable',
 *     type: 'String',
 *     scope: 'Process_1',
 *     origin: [ 'Task_1' ]
 *    },
 *    {
 *     name: 'myVariable',
 *     type: 'Number',  // Same Variable with different types
 *     scope: 'Process_1',
 *     origin: [ 'Task_2' ]
 *    }
 *  ]
 * }
 */
```

## Development

Prepare the project by installing all dependencies:

```sh
npm install
```

Then, start the example with:

```sh
npm start
```

## License

MIT
