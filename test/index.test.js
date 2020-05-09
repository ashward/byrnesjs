const byrnes = require("..");

byrnes.init({
  rootDir: __dirname,
  allow: [
    {
      module: "node_modules/source-map-support/",
      privileges: byrnes.PRIV_FILESYSTEM,
      alwaysAllow: true,
    },
    {
      module: [
        "/",
        "node_modules/jest-message-util/",
        "node_modules/jest-runtime/",
        "node_modules/jest-jasmine2/",
        "node_modules/@jest/",
        "node_modules/jest-runner/",
        "node_modules/jest-cli/",
        "node_modules/source-map-support/",
        "node_modules/expect/",
        "node_modules/jsdom/",
        "node_modules/jest-resolve/",
        "node_modules/resolve",
        "node_modules/jest-environment-jsdom/",
      ],
      privileges: byrnes.PRIV_ALL,
    },
    {
      module: ["node_modules/byrnesjs-trustedtestmodule"],
      privileges: "*",
    },
    {
      module: [
        "node_modules/byrnesjs-untrusted", // This is to test that it doesn't trust all modules that start with a trusted module name
      ],
      privileges: "fs",
    },
  ],
  logOnly: false,
});

const trusted = require("byrnesjs-trustedtestmodule");
const untrusted = require("byrnesjs-untrustedtestmodule");

test("It disallows multiple inititalisations", () => {
  expect(() => {
    byrnes.init({ rootDir: "" });
  }).toThrow();
});

test("It allows fs access to trusted module", () => {
  expect(() => {
    trusted.testFsAccess();
  }).not.toThrow();
});

test("It disallows fs access to untrusted module", () => {
  expect(() => {
    untrusted.testFsAccess();
  }).toThrow();
});

test("It allows net access to trusted module", () => {
  expect(() => {
    trusted.testNetAccess();
  }).not.toThrow();
});

test("It disallows net access to untrusted module", () => {
  expect(() => {
    untrusted.testNetAccess();
  }).toThrow();
});

test("It allows child_process access to trusted module", () => {
  expect(() => {
    trusted.testChildProcess();
  }).not.toThrow();
});

test("It disallows child_process access to untrusted module", () => {
  expect(() => {
    untrusted.testChildProcess();
  }).toThrow();
});

test("It allows vm access to trusted module", () => {
  expect(() => {
    trusted.testVm();
  }).not.toThrow();
});

test("It disallows vm access to untrusted module", () => {
  expect(() => {
    untrusted.testVm();
  }).toThrow();
});

test("It allows dgram access to trusted module", () => {
  expect(() => {
    trusted.testDatagram();
  }).not.toThrow();
});

test("It disallows dgram access to untrusted module", () => {
  expect(() => {
    untrusted.testDatagram();
  }).toThrow();
});

test("It allows dns access to trusted module", () => {
  expect(() => {
    trusted.testDNS();
  }).not.toThrow();
});

test("It disallows dns access to untrusted module", () => {
  expect(() => {
    untrusted.testDNS();
  }).toThrow();
});

test("It allows worker_threads access to trusted module", () => {
  expect(() => {
    trusted.testWorkerThreads();
  }).not.toThrow();
});

test("It disallows worker_threads access to untrusted module", () => {
  expect(() => {
    untrusted.testWorkerThreads();
  }).toThrow();
});

test("It allows process access to trusted module", () => {
  expect(() => {
    trusted.testProcess();
  }).not.toThrow();
});

test("It disallows process access to untrusted module", () => {
  expect(() => {
    untrusted.testProcess();
  }).toThrow();
});
