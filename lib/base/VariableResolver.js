import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';
import CachedValue from '../util/CachedValue';
import { hasInputParameter, hasOutputMappings } from '../util/ExtensionElementsUtil';
import { parseIoMappings } from '../util/feelUtility';

export class BaseVariableResolver {
  constructor(eventBus, bpmnjs) {
    this.providers = [];
    this._eventBus = eventBus;
    this._bpmnjs = bpmnjs;

    this.rawVariables = new CachedValue(this._generateRawVariables.bind(this));
    this.parsedVariables = new CachedValue(this._parseVariables.bind(this));

    eventBus.on([ 'commandStack.changed', 'diagram.clear', 'import.done', 'variables.changed' ], () => {
      this.invalidateCache();
    });
  }

  async getRawVariables() {
    return await this.rawVariables.get();
  }

  async getVariables() {
    return await this.parsedVariables.get();
  }

  invalidateCache() {
    this.rawVariables.invalidate();
    this.parsedVariables.invalidate();
  }

  async _generateRawVariables() {
    const bpmnjs = this._bpmnjs;

    const variables = {};

    const workerTasks = bpmnjs.getDefinitions().rootElements.map(async element => {
      variables[element.id] = await this._baseExtractor(element, [ this._extractor.bind(this) ]);
    });

    await Promise.all(workerTasks);

    return variables;
  }

  async _parseVariables() {
    const rawVariables = await this.getRawVariables();


    const parsedVariables = {};
    for (const key in rawVariables) {
      const variables = rawVariables[key];

      parseIoMappings(variables);

      const mergedVariables = [];

      variables.forEach(variable => {
        const existingVariable = mergedVariables.find(v =>
          v.name === variable.name && v.scope === variable.scope
        );

        if (existingVariable) {
          existingVariable.origin.push(...variable.origin);
          mergeEntries(existingVariable, variable);
        } else {
          mergedVariables.push(variable);
        }
      });

      mapToEditorFormat(mergedVariables);

      parsedVariables[key] = mergedVariables;
    }

    return parsedVariables;
  }

  async _extractor(options) {
    const {
      elements,
      containerElement,
      processVariables
    } = options;

    const self = this;

    let workerTasks;

    elements.forEach((element) => {
      workerTasks = self.providers.map(async (provider) => {
        const newVariables = await provider.getVariables(element);

        if (!newVariables) {
          return;
        }

        // add scope and origin to variables
        newVariables.forEach(variable => {
          variable.origin = [ element ];
          variable.scope = variable.scope || getScope(element, containerElement, variable.name);
        });

        processVariables.push(...newVariables);
      });
    });

    await Promise.all(workerTasks);
  }

  registerProvider(provider) {
    this.providers.push(provider);
    this.invalidateCache();
  }

  async getProcessVariables(element) {
    const bo = getBusinessObject(element);

    const allVariables = await this.getVariables();
    return allVariables[bo.id] || [];
  }

  async getVariablesForElement(element) {
    const bo = getBusinessObject(element);

    const root = getRootElement(bo);
    const allVariables = await this.getProcessVariables(root);

    // (1) get variables for given scope
    var scopeVariables = allVariables.filter(function(variable) {
      return variable.scope.id === bo.id;
    });

    // (2) get variables for parent scopes
    var parents = getParents(bo);

    var parentsScopeVariables = allVariables.filter(function(variable) {
      return parents.find(function(parent) {
        return parent.id === variable.scope.id;
      });
    });

    return [ ...scopeVariables, ...parentsScopeVariables ];
  }
}

BaseVariableResolver.$inject = [ 'eventBus', 'bpmnjs' ];


// helpers //////////////////////

function getRootElement(element) {
  const businessObject = getBusinessObject(element);

  if (is(businessObject, 'bpmn:Participant')) {
    return businessObject.processRef;
  }

  if (is(businessObject, 'bpmn:Process')) {
    return businessObject;
  }

  let parent = businessObject;

  while (parent.$parent && !is(parent, 'bpmn:Process')) {
    parent = parent.$parent;
  }

  return parent;
}

function getParents(element) {
  var parents = [];
  var current = element;

  while (current.$parent) {
    parents.push(current.$parent);
    current = current.$parent;
  }

  return parents;
}

function getScope(element, globalScope, variableName) {
  var parents = getParents(element);

  if (hasOutputMappings(element)) {
    return element;
  }

  var scopedParent = parents.find(function(parent) {
    return (
      is(parent, 'bpmn:SubProcess') && hasInputParameter(parent, variableName)
    );
  });

  return scopedParent ? scopedParent : globalScope;
}

function mergeEntries(target, source) {
  target.type = extendList(target.type, source.type, '|');
  target.info = extendList(target.info, source.info, '\n');
  target.isList = !!target.isList === !!source.isList ? target.isList : 'optional';

  if (!source.entries) {
    return;
  }

  if (!target.entries) {
    target.entries = [];
  }

  source.entries.forEach(variable => {
    const existingEntry = target.entries.find(e => e.name === variable.name);

    if (existingEntry) {
      mergeEntries(existingEntry, variable);
    } else {
      target.entries.push(variable);
    }
  });
}

const extendList = (target, source, separator) => {
  if (!target || target === source) {
    return source;
  } else {
    const existingTypes = target.split(separator);
    if (!existingTypes.includes(source)) {
      existingTypes.push(source);
    }
    return existingTypes.join(separator);
  }
};

function mapToEditorFormat(variables) {
  if (!variables) {
    return;
  }

  variables.forEach(variable => {
    variable.detail = variable.type;
    mapToEditorFormat(variable.entries);
  });
}