import { expect } from 'chai';

import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';

import { getProcessVariables } from '@bpmn-io/extract-process-variables/zeebe';

import { bootstrapModeler, getBpmnJS } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

import { parseVariables } from 'lib/zeebe/util/feelUtility';

import feel100 from 'test/fixtures/zeebe/mappings/feel-100.bpmn';

const ITERATIONS = 5;

describe('ZeebeVariableResolver - Performance', function() {

  const bootstrap = bootstrapModeler(feel100, {
    additionalModules: [
      ZeebeVariableResolverModule
    ],
    moddleExtensions: {
      zeebe: ZeebeModdle
    }
  });

  it('performance should not decrease significantly', async function() {

    let totalDuration = 0;

    for (let index = 0; index < ITERATIONS; index++) {
      const start = performance.now();
      await bootstrap.call(this);
      const variableResolver = getBpmnJS().get('variableResolver');
      await variableResolver.getVariables();
      const end = performance.now();
      const duration = end - start;

      totalDuration += duration;
    }

    const averageDuration = totalDuration / ITERATIONS;
    expect(averageDuration).to.be.lessThan(300);
  });


  describe('scaling', function() {

    this.timeout(30000);

    beforeEach(bootstrap);


    it('should parse variables in linear time', async function() {

      // given
      const moddle = getBpmnJS().get('moddle');

      const small = await getRawVariables(moddle, 50);
      const large = await getRawVariables(moddle, 400);

      // warm up
      measureParseVariables(small);

      // when
      const smallDuration = measureParseVariables(small);
      const largeDuration = measureParseVariables(large);

      // then
      // 8 times the mappings take ~8 times as long if linear,
      // ~64 times as long if quadratic
      expect(largeDuration / smallDuration).to.be.lessThan(12);
    });

  });

});


// helpers //////////

const RUNS = 3;

/**
 * Create a process with service tasks, each with 10 input and 10 output
 * mappings. Output mappings of all tasks write the same variables.
 *
 * @param {number} taskCount
 *
 * @return {string}
 */
function createProcessXML(taskCount) {
  let tasks = '';

  for (let task = 0; task < taskCount; task++) {
    let mappings = '';

    for (let mapping = 0; mapping < 10; mapping++) {
      mappings += `<zeebe:input source="=get entries(context)" target="input${ mapping }" />`;
    }

    for (let mapping = 0; mapping < 10; mapping++) {
      mappings += `<zeebe:output source="=get entries(context)" target="output${ mapping }" />`;
    }

    tasks += `
      <bpmn:serviceTask id="Task_${ task }">
        <bpmn:extensionElements>
          <zeebe:ioMapping>${ mappings }</zeebe:ioMapping>
        </bpmn:extensionElements>
      </bpmn:serviceTask>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
    <bpmn:definitions
      xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
      id="Definitions_1"
      targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="Process_1" isExecutable="true">${ tasks }
      </bpmn:process>
    </bpmn:definitions>`;
}

async function getRawVariables(moddle, taskCount) {
  const { rootElement: definitions } = await moddle.fromXML(createProcessXML(taskCount));

  return getProcessVariables(definitions.rootElements[0]);
}

/**
 * @param {Array<ProcessVariable>} rawVariables
 *
 * @return {number} fastest duration of multiple runs, in milliseconds
 */
function measureParseVariables(rawVariables) {
  let fastest = Infinity;

  for (let run = 0; run < RUNS; run++) {

    // parsing annotates variables, start fresh each run
    const variables = rawVariables.map(variable => ({ ...variable }));

    const start = performance.now();

    parseVariables(variables);

    fastest = Math.min(fastest, performance.now() - start);
  }

  return fastest;
}
