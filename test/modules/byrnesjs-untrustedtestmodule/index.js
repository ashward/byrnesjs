const fs = require("fs");
const net = require("net");
const child_process = require("child_process");
const vm = require("vm");
const dgram = require("dgram");
const { Resolver } = require('dns');
const { Worker } = require("worker_threads");

module.exports = {
    testFsAccess : () => {
        fs.readdirSync('.');
    },

    testNetAccess : () => {
        net.createServer();
    },

    testChildProcess : () => {
        child_process.exec('ls');
    },

    testVm : () => {
         vm.runInNewContext('const a = 1;');
    },

    testDatagram : () => {
        dgram.createSocket('udp4');
    },

    testDNS : () => {
        new Resolver();
    },

    testWorkerThreads: () => {
        new Worker('const a = 1;', { eval: true });
    }
}