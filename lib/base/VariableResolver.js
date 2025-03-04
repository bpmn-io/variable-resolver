import { getBusinessObject, is } from 'bpmn-js/lib/util/ModelUtil';
import CachedValue from './util/CachedValue';
import { getParents, getScope } from './util/scopeUtil';
import { uniqueBy } from 'min-dash';

/**
 * @typedef {Object} AdditionalVariable
 * @property {string} name The name of the variable
 * @property {string} [type] The type of the variable
 * @property {string} [info] A description of the variable displayed as a tooltip
 * @property {boolean} [isList] whether the variable is a list
 * @property {Array<AdditionalVariable>} [entries] If the variable is a context, this contains the entries of the context
 * @property {djs.model.Base} [scope] The scope of the variable, by default it is the container element of the element the variable is created from
 */

/**
 * @typedef {AdditionalVariable} ProcessVariable
 * @property {Array<ModdleElement>} origin
 * @property {ModdleElement} scope
 */

/**
 * Base Class that handles additional variable extractors, variable parsing and caching.
 */
export class BaseVariableResolver {
  constructor(eventBus, bpmnjs) {
    this.providers = [];
    this._eventBus = eventBus;
    this._bpmnjs = bpmnjs;

    this.rawVariables = new CachedValue(this._generateRawVariables.bind(this));
    this.parsedVariables = new CachedValue(async () => {

      const rawVariables = await this.getRawVariables();
      const context = { variables: rawVariables };

      eventBus.fire('variableResolver.parseVariables', context);

      return context.variables;
    });

    eventBus.on([ 'commandStack.changed', 'diagram.clear', 'import.done', 'variables.changed' ], () => {
      this.invalidateCache();
    });

    eventBus.on('variableResolver.parseVariables', (e, context) => {
      context.variables = this._parseVariables(context.variables);
    });
  }

  /**
   * To be implemented by super class. This should be an instance of `getProcessVariables` from `@bpmn-io/extract-process-variables`,
   * either C7 or C8.
   *
   * @returns {Promise<Array<ProcessVariable>>}
   */
  _baseExtractor() {
    return [];
  }


  /**
   * Returns an Object of all variables that are available in the current diagram,
   * mapped to the respective scope.
   * Variables with the same name are NOT merged together. Use this function to
   * run linting, e.g. to check for conflicting variable schemas.
   *
   * The result is cached until the diagram changes.
   *
   * @async
   * @returns {Object} rawVariables
   * @returns {Array<ProcessVariable>} rawVariables.<scope>
   */
  async getRawVariables() {
    return await this.rawVariables.get();
  }

  /**
   * Returns an array of all variables that are available in the current diagram.
   * Variables with the same name are NOT merged together. Use this function to
   * run linting, e.g. to check for conflicting variable schemas.
   *
   * Use this function if you need all availables for all root elements. To filter for scope,
   * use `getProcessVariables` or `getVariablesForElement`
   *
   * The result is cached until the diagram changes.
   *
   * @async
   * @returns {Object} rawVariables
   * @returns {Array<ProcessVariable>} rawVariables.<rootElement>
   */
  async getVariables() {
    return await this.parsedVariables.get();
  }

  /**
   * Force the cache to be invalidated an the variable extractors to be called
   * again the next time `getVariables` is called.
   */
  invalidateCache() {
    this.rawVariables.invalidate();
    this.parsedVariables.invalidate();
  }

  /**
   * Calls the baseExtractor and maps variables to the respective root element.
   * Cf. `getRawVariables`
   *
   * @async
   * @returns {Object} rawVariables
   * @returns {Array<ProcessVariable>} rawVariables.<scope>
   */
  async _generateRawVariables() {
    const bpmnjs = this._bpmnjs;

    const variables = {};

    const workerTasks = bpmnjs.getDefinitions().get('rootElements').map(async element => {

      const elementVariables = await this._baseExtractor(element, [ this._extractor.bind(this) ]);

      // Annotate variables with extractor information
      variables[element.id] = elementVariables.map(variable => {
        if (!variable.provider) {
          variable.provider = [ this._baseExtractor ];
        }

        return variable;
      });
    });

    await Promise.all(workerTasks);

    return variables;
  }


  /**
   * Parses the list of all variables and checks for duplicates. If duplicates are found, the schemas are merged
   * into a single variable.
   * Also maps the attribute `variable.type` to `variable.detail` for the feel editor to display it.
   *
   * Cf. `getVariables`
   *
   * @async
   * @param {Object} rawVariables
   * @param {Array<ProcessVariable>} rawVariables[scope]
   * @returns {Object} parsedVariables
   * @returns {Array<ProcessVariable>} parsedVariables[scope]
   */
  _parseVariables(rawVariables) {
    const parsedVariables = {};
    for (const key in rawVariables) {
      const variables = rawVariables[key];

      const mergedVariables = [];

      variables.forEach(variable => {
        const existingVariable = mergedVariables.find(v =>
          v.name === variable.name && v.scope === variable.scope
        );

        if (existingVariable) {
          merge('origin', existingVariable, variable);
          merge('provider', existingVariable, variable);
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

  /**
   * Callback used by `@bpmn-io/extract-process-variables`. It adds additional information from the <AdditionalVariable>
   * returned from the providers to the <ProcessVariable> that is used by the resolver.
   *
   * It does not have a return value, the variables are added as a side effect to the `context.processVariables` array
   *
   * @async
   * @param {Object} context
   * @param {Array<ModdleElement>} context.elements
   * @param {ModdleElement} context.containerElement
   * @param {Array<ProcessVariable>} context.processVariables
   */
  async _extractor(context) {
    const {
      elements,
      containerElement,
      processVariables
    } = context;

    const self = this;

    const workerTasks = elements.flatMap((element) => {
      return self.providers.map(async (provider) => {
        const newVariables = await provider.getVariables(element);

        if (!newVariables) {
          return;
        }

        // add scope and origin to variables
        newVariables.forEach(variable => {
          processVariables.push({
            ...cloneVariable(variable),
            origin: [ element ],
            scope: variable.scope || getScope(element, containerElement, variable.name),
            provider: [ provider ]
          });
        });
      });
    });

    await Promise.all(workerTasks);
  }

  /**
   * Add a new VariableProvider. This will be used the next time `getVariables` is called.
   *
   * @param {VariableProvider} provider
   */
  registerProvider(provider) {
    this.providers.push(provider);
    this.invalidateCache();
  }

  /**
   * Returns all variables for the given root element.
   *
   * @async
   * @param {ModdleElement} element
   * @returns {Array<ProcessVariable>} variables
   */
  async getProcessVariables(element) {
    const bo = getBusinessObject(element);

    const allVariables = await this.getVariables();
    return allVariables[bo.id] || [];
  }

  /**
   * Returns all variables in the scope of the given element.
   *
   * @async
   * @param {ModdleElement} element
   * @returns {Array<ProcessVariable>} variables
   */
  async getVariablesForElement(element) {
    const bo = getBusinessObject(element);

    const root = getRootElement(bo);
    const allVariables = await this.getProcessVariables(root);

    // keep only unique variables based on name property
    const uniqueVariables = uniqueBy('name', allVariables.reverse());

    // (1) get variables for given scope
    var scopeVariables = uniqueVariables.filter(function(variable) {
      return variable.scope.id === bo.id;
    });

    // (2) get variables for parent scopes
    var parents = getParents(bo);

    var parentsScopeVariables = uniqueVariables.filter(function(variable) {
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

function merge(property, target, source) {
  if (!source[property]) {
    source[property] = [];
  }

  if (!target[property]) {
    target[property] = [];
  }

  const propertiesToAdd = source[property].filter(o => !target[property].includes(o));

  target[property].push(...propertiesToAdd);
}

export function mergeEntries(target, source, visited = []) {
  if (visited.includes(source) || visited.includes(target)) {
    return;
  }
  visited.push(source);
  visited.push(target);

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
      mergeEntries(existingEntry, variable, visited);
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

function cloneVariable(variable) {
  const newVariable = { ...variable };

  if (newVariable.entries) {
    newVariable.entries = newVariable.entries.map(cloneVariable);
  }

  return newVariable;
}