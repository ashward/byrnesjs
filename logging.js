// This is a very simple worker which will just reflect a posted message back to the parent.
const {
    parentPort
  } = require('worker_threads');

parentPort.on('message', (message) => {
    parentPort.postMessage(message);
});

