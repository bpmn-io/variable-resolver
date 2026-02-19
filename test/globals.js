const { use } = require('chai');
const { default: sinonChai } = require('sinon-chai');

const { variableAssertions } = require('./assertions');

use(variableAssertions);
use(sinonChai);