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

  describe('variables in scope', function() {

    this.timeout(30000);

    beforeEach(bootstrap);


    it('should not slow down parsing with many variables in scope', async function() {

      // given
      const moddle = getBpmnJS().get('moddle');

      // same mappings, writing 10 or 1,000 distinct variables
      const fewVariables = await createVariables(moddle, 10);
      const manyVariables = await createVariables(moddle, 1000);

      // warm up
      measureParsing(fewVariables);

      // when
      const fewDuration = measureParsing(fewVariables);
      const manyDuration = measureParsing(manyVariables);

      // then
      expect(manyDuration / fewDuration).to.be.lessThan(4);
    });


    /**
     * Create the variables of 100 service tasks with 10 input and 10 output
     * mappings each. Input mappings read output variables of the previous
     * task in a context. Output mappings write the given number of distinct
     * variables in total.
     *
     * @param {Object} moddle
     * @param {number} variableCount
     *
     * @return {Promise<Array<ProcessVariable>>}
     */
    async function createVariables(moddle, variableCount) {
      const taskCount = 100;

      const getName = (task, mapping) => {
        return `processVariable_${ (task * 10 + mapping) % variableCount }`;
      };

      let tasks = '';

      for (let task = 0; task < taskCount; task++) {
        let mappings = '';

        for (let mapping = 0; mapping < 10; mapping++) {
          const entries = [];

          for (let entry = 0; entry < 10; entry++) {
            entries.push(`key${ entry }: ${ getName(Math.max(task - 1, 0), entry) }`);
          }

          mappings += `<zeebe:input source="={ ${ entries.join(', ') } }" target="input${ mapping }" />`;
        }

        for (let mapping = 0; mapping < 10; mapping++) {
          mappings += `<zeebe:output source="=${ mapping }" target="${ getName(task, mapping) }" />`;
        }

        tasks += `
          <bpmn:serviceTask id="Task_${ task }">
            <bpmn:extensionElements>
              <zeebe:ioMapping>${ mappings }</zeebe:ioMapping>
            </bpmn:extensionElements>
          </bpmn:serviceTask>`;
      }

      const { rootElement: definitions } = await moddle.fromXML(`<?xml version="1.0" encoding="UTF-8"?>
        <bpmn:definitions
          xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
          xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
          id="Definitions_1"
          targetNamespace="http://bpmn.io/schema/bpmn">
          <bpmn:process id="Process_1" isExecutable="true">${ tasks }
          </bpmn:process>
        </bpmn:definitions>`);

      return getProcessVariables(definitions.rootElements[0]);
    }

    /**
     * @param {Array<ProcessVariable>} variables
     *
     * @return {number} fastest duration of three runs, in milliseconds
     */
    function measureParsing(variables) {
      let fastest = Infinity;

      for (let run = 0; run < 3; run++) {

        // parsing annotates variables, start fresh each run
        const copies = variables.map(variable => ({ ...variable }));

        const start = performance.now();

        parseVariables(copies);

        fastest = Math.min(fastest, performance.now() - start);
      }

      return fastest;
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

});
