const fs = require('fs');
const net = require('net');
const child_process = require('child_process');
const vm = require('vm');
const dgram = require('dgram');
const dns = require('dns');
const worker_threads = require('worker_threads');

const PRIV_ALL = '*';
const PRIV_FILESYSTEM = 'fs';
const PRIV_NETWORK = 'net';
const PRIV_CHILD_PROCESS = 'child_process';
const PRIV_VM = 'vm';
const PRIV_DGRAM = 'dgram';
const PRIV_DNS = 'dns';
const PRIV_WORKER_THREADS = 'worker_threads';

const { Worker } = require('worker_threads');

// These are the controlled modules
const controlledModules = {
  fs: fs,
  net: net,
  child_process: child_process,
  vm: vm,
  dgram: dgram,
  dns: dns,
  worker_threads: worker_threads,
};

// This is a flag to ensure it's only initialised once
let byrnesInitialised = false;

const allowCache = {};

const defaultAllowList = [
  {
    // This is to allow 'require()' to work from anywhere
    module: 'internal/modules/cjs/loader.js',
    privileges: [PRIV_FILESYSTEM],
    alwaysAllow: true,
  },
  {
    // This is to allow 'new Buffer()' to work from anywhere
    module: 'internal/util.js',
    privileges: [PRIV_VM],
    alwaysAllow: true,
  },
  {
    // This is to allow this library to access everything (as it will always be in the call stack)
    module: [__dirname, 'node_modules/byrnesjs/'],
    privileges: PRIV_ALL,
  },
  {
    // Allow anonymous blocks and internal NodeJS code
    module: ['<anonymous>', 'internal/'],
    privileges: PRIV_ALL,
  },
  {
    // This is the set of internal libraries which access the filesystem
    module: [
      'fs.js',
      'events.js',
      '_stream_writable.js',
      'timers.js',
      'net.js',
    ],
    privileges: [PRIV_FILESYSTEM],
  },
  {
    // This is the set of internal libararies which access the network
    module: ['tty.js', 'http.js', '_http_server.js'],
    privileges: [PRIV_NETWORK],
  },
  {
    // This is the set of internal libararies which access the network
    module: 'net.js',
    privileges: [PRIV_DNS],
  },
  {
    module: 'child_process.js',
    privileges: [PRIV_CHILD_PROCESS, PRIV_NETWORK],
  },
];

// This pattern is used to parse the stack entries
const stackEntryPattern = /^\s+at\s[^(]+\((([^:)]+):\d*:?\d*)\)$/gm;

module.exports = {
  PRIV_ALL,
  PRIV_FILESYSTEM,
  PRIV_NETWORK,
  PRIV_CHILD_PROCESS,
  PRIV_VM,
  PRIV_DGRAM,
  PRIV_DNS,
  PRIV_WORKER_THREADS,

  init: (options) => {
    // Prevent the library being initialised multiple times
    if (byrnesInitialised) {
      throw new Error('ByrnesJS is already initialised');
    }

    byrnesInitialised = true;

    // Merge the supplied allow list
    const allows = [...defaultAllowList];

    if (options.allow) {
      allows.push(...options.allow);
    }

    if (!options.rootDir) {
      throw new Error('rootDir is required');
    }

    // And the rest of the options
    const opts = {
      rootDir: options.rootDir,
      logOnly: options.logOnly || false,
      logger: options.logger || console,
      logOnlyStack: options.logOnlyStack || false,
      violationLogger:
        options.violationLogger && typeof options.violationLogger == 'function'
          ? options.violationLogger
          : console.error,
    };

    // Refactor the allow list into something more useful to check against
    const allowByOperation = {};

    allows.forEach((allow) => {
      let privileges = Array.isArray(allow.privileges)
        ? allow.privileges
        : [allow.privileges];

      if (privileges.includes('*')) {
        privileges = Object.keys(controlledModules);
      }

      privileges.forEach((privilege) => {
        let newAllows;

        if (Array.isArray(allow.module)) {
          newAllows = allow.module.map((path) => ({
            path: path,
            alwaysAllow: !!allow.alwaysAllow,
          }));
        } else {
          newAllows = [
            { path: allow.module, alwaysAllow: !!allow.alwaysAllow },
          ];
        }

        if (allowByOperation[privilege]) {
          allowByOperation[privilege].push(...newAllows);
        } else {
          allowByOperation[privilege] = newAllows;
        }
      });
    });

    // Initialise the logging
    // This is done through a worker so that it's in a different stack frame.
    const loggingWorker = new Worker(`${__dirname}/logging.js`);

    const loggingMessages = [];

    // Unref the thread when it starts so that it doesn't hold the process open
    loggingWorker.on('online', () => {
      if (loggingMessages.length == 0) {
        loggingWorker.unref();
      }
    });

    loggingWorker.on('message', () => {
      while (loggingMessages.length > 0) {
        const message = loggingMessages.shift();
        opts.violationLogger(message);
      }

      loggingWorker.unref();
    });

    function logIssue(message) {
      // We ref() the worker to ensure that the message gets logged before the process quits.
      loggingWorker.ref();
      loggingMessages.push(message);

      loggingWorker.postMessage(message);
    }

    // This function is called by the privileged function wrapper to do the actual check
    function doFunctionCall(
      privilegeId,
      actualFunc,
      stackString,
      thisArg,
      args,
      newTarget
    ) {
      const stackMatches = [...stackString.matchAll(stackEntryPattern)];

      for (let stackMatch of stackMatches) {
        const stackEntry = stackMatch[2];

        const allowed = checkAllowed(stackEntry, privilegeId);

        if (!allowed) {
          if (opts.logOnly) {
            logIssue(
              `ByrnesJS: Detected unexpected access to '${privilegeId}.${actualFunc.name}()' from '${stackEntry}'`
            );

            if (opts.logOnlyStack) {
              logIssue(stackString);
            }

            //            break;
          } else {
            const error = new Error(
              `ByrnesJS: Access to '${privilegeId}.${actualFunc.name}()' is denied from '${stackEntry}'`
            );

            logIssue(error.message);

            throw error;
          }
        } else {
          if (allowed.alwaysAllow) {
            if (newTarget) {
              return new actualFunc(...args);
            } else {
              return actualFunc.apply(thisArg, args);
            }
          }
        }
      }

      if (newTarget) {
        return new actualFunc(...args);
      } else {
        return actualFunc.apply(thisArg, args);
      }
    }

    // This checks a single stack entry for a certain operation
    function checkAllowed(path, operation) {
      if (path in allowCache) {
        if (operation in allowCache[path]) {
          return allowCache[path][operation];
        }
      } else {
        allowCache[path] = {};
      }

      let stackEntry = path;

      const nodeModulesRoot = stackEntry.lastIndexOf('node_modules');

      if (nodeModulesRoot > -1) {
        stackEntry = stackEntry.substring(nodeModulesRoot);
      } else if (stackEntry.startsWith(opts.rootDir)) {
        stackEntry = stackEntry.substring(opts.rootDir.length);
      }

      for (const allow of allowByOperation[operation]) {
        if (stackEntry.startsWith(allow.path)) {
          allowCache[path][operation] = { alwaysAllow: allow.alwaysAllow };
          return allowCache[path][operation];
        }
      }

      allowCache[path][operation] = false;
      return false;
    }

    // This goes through each of the privileged modules and wraps all the functions within
    for (const privilegeId in controlledModules) {
      const privilegedModule = controlledModules[privilegeId];

      for (const key in privilegedModule) {
        if (
          privilegedModule.hasOwnProperty(key) &&
          typeof privilegedModule[key] == 'function'
        ) {
          // If it's a function then we will wrap it with our access check code
          const actualFunc = privilegedModule[key];

          if (actualFunc.constructor.name === 'AsyncFunction') {
            privilegedModule[key] = async function () {
              const stackString = new Error().stack;

              return await doFunctionCall(
                privilegeId,
                actualFunc,
                stackString,
                this,
                Array.from(arguments),
                new.target
              );
            };
          } else {
            privilegedModule[key] = function () {
              const stackString = new Error().stack;

              return doFunctionCall(
                privilegeId,
                actualFunc,
                stackString,
                this,
                Array.from(arguments),
                new.target
              );
            };
          }

          // Copy across the prototype
          privilegedModule[key].prototype = actualFunc.prototype;

          // And any other properties. This ensures that `fs.realpath.native` and `fs.realpathSync.native` are still accessible
          for (const name in actualFunc) {
            if (actualFunc.hasOwnProperty(name)) {
              privilegedModule[key][name] = actualFunc[name];
            }
          }
        }
      }
    }
  },
};
