import TestContainer from 'mocha-test-container-support';

import {
  bootstrapBpmnJS,
  inject,
  insertCSS
} from 'bpmn-js/test/helper';

import Modeler from 'bpmn-js/lib/Modeler';

let PROPERTIES_PANEL_CONTAINER;

export * from 'bpmn-js/test/helper';

export {
  createCanvasEvent,
  createEvent
} from 'bpmn-js/test/util/MockEvents';

export function bootstrapPropertiesPanel(diagram, options, locals) {
  return async function() {
    const container = TestContainer.get(this);

    // (1) create modeler + import diagram
    await bootstrapBpmnJS(Modeler, diagram, options, locals);

    // (2) clean-up properties panel
    clearPropertiesPanelContainer();

    // (3) attach properties panel
    const attachPropertiesPanel = inject(function(propertiesPanel) {
      PROPERTIES_PANEL_CONTAINER = document.createElement('div');
      PROPERTIES_PANEL_CONTAINER.classList.add('properties-container');

      container.appendChild(PROPERTIES_PANEL_CONTAINER);

      propertiesPanel.attachTo(PROPERTIES_PANEL_CONTAINER);
    });
    await attachPropertiesPanel();
  };
}

export function clearPropertiesPanelContainer() {
  if (PROPERTIES_PANEL_CONTAINER) {
    PROPERTIES_PANEL_CONTAINER.remove();
  }
}

export function insertCoreStyles() {
  insertCSS(
    'test.css',
    require('./test.css')
  );

  insertCSS(
    'properties-panel.css',
    require('@bpmn-io/properties-panel/dist/assets/properties-panel.css')
  );

  insertCSS(
    'element-templates.css',
    require('bpmn-js-element-templates/dist/assets/element-templates.css')
  );

  insertCSS(
    'element-template-chooser.css',
    require('@bpmn-io/element-template-chooser/dist/element-template-chooser.css')
  );

  insertCSS(
    'diagram.css',
    require('bpmn-js/dist/assets/diagram-js.css')
  );

  insertCSS(
    'bpmn-js.css',
    require('bpmn-js/dist/assets/bpmn-js.css')
  );

  insertCSS(
    'bpmn-font.css',
    require('bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css')
  );
}

export function bootstrapModeler(diagram, options, locals) {
  return bootstrapBpmnJS(Modeler, diagram, options, locals);
}