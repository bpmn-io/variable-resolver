import ZeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe';

import { bootstrapModeler, getBpmnJS } from 'test/TestHelper';

import { ZeebeVariableResolverModule } from 'lib/';

import feel400 from 'test/fixtures/zeebe/mappings/feel-400.bpmn';

const ITERATIONS = 20;

describe('ZeebeVariableResolver - Performance', function() {

  const bootstrap = bootstrapModeler(feel400, {
    additionalModules: [
      ZeebeVariableResolverModule
    ],
    moddleExtensions: {
      zeebe: ZeebeModdle
    }
  });

  // eslint-disable-next-line mocha/no-exclusive-tests
  it.only('measure performance', async function() {
    this.timeout(30000);

    let totalDuration = 0;

    for (let index = 0; index < ITERATIONS; index++) {
      const start = performance.now();
      await bootstrap.call(this);
      const variableResolver = getBpmnJS().get('variableResolver');
      await variableResolver.getVariables();
      const end = performance.now();
      const duration = end - start;

      totalDuration += duration;
      console.log(`Performance test #${index + 1}: ${duration.toFixed(2)}ms`);
    }

    const averageDuration = totalDuration / ITERATIONS;
    console.log(`Performance test average (${ITERATIONS} runs): ${averageDuration.toFixed(2)}ms`);
  });

});
