const fs = require("fs");
const net = require("net");
const child_process = require("child_process");

let byrnesInitialised = false;

const allowCache = {};

const defaultAllowList = [
  {
    // This is to allow 'require()' to work from anywhere
    module: "internal/modules/cjs/loader.js",
    privileges: ["fs"],
    alwaysAllow: true,
  },
  {
    // This is to allow this library to access the filesystem and network
    module: [__dirname, "node_modules/byrnesjs/"],
    privileges: ["fs", "net"],
  },
  {
    module: ["<anonymous>", "internal/"],
    privileges: "*",
  },
  {
    // This is the set of internal libraries which access the filesystem
    module: [
      "fs.js",
      "events.js",
      "_stream_writable.js",
      "timers.js",
      "net.js",
    ],
    privileges: ["fs"],
  },
  {
    // This is the set of internal libararies which access the network
    module: ["tty.js", "http.js", "_http_server.js"],
    privileges: ["net"],
  },
];

// This pattern is used to parse the stack entries
const stackEntryPattern = /^\s+at\s[^(]+\((([^:)]+):\d*:?\d*)\)$/gm;

const privilegeModules = {
  fs: fs,
  net: net,
  child_process: child_process,
};

module.exports = {
  init: (options) => {
    // Prevent the library being initialised multiple times
    if (byrnesInitialised) {
      throw new Error("ByrnesJS is already initialised");
    }

    byrnesInitialised = true;

    // Merge the supplied allow list
    const allows = [...defaultAllowList];

    if (options.allow) {
      allows.push(...options.allow);
    }

    if(!options.rootDir) {
      throw new Error('rootDir is required');
    }

    // And the rest of the options
    const opts = {
      rootDir: options.rootDir,
      logOnly: options.logOnly || false,
      violationLogger:
        options.violationLogger && typeof options.violationLogger == "function"
          ? options.violationLogger
          : console.error,
    };

    // Refactor the allow list into something more useful to check against
    const allowByOperation = {};

    allows.forEach((allow) => {
      let privileges = allow.privileges;

      if (privileges === "*") {
        privileges = Object.keys(privilegeModules);
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

    // This function is called by the privileged function wrapper to do the actual check
    function doFunctionCall(
      privilegeId,
      actualFunc,
      stackString,
      thisArg,
      args
    ) {
      const stackMatches = [...stackString.matchAll(stackEntryPattern)];

      for (let stackMatch of stackMatches) {
        const stackEntry = stackMatch[2];

        const allowed = checkAllowed(stackEntry, privilegeId);

        if (!allowed) {
          if (opts.logOnly) {
            logIssue(
              `ByrnesJS: Detected unexpected access to '${privilegeId}' from '${stackMatch[1]}'`
            );

            if (opts.logOnlyStack) {
              logIssue(stackString);
            }

            //            break;
          } else {
            const error = new Error(
              `Access to '${privilegeId}' is denied from '${stackEntry}'`
            );

            logIssue(error.message);

            throw error;
          }
        } else {
          if (allowed.alwaysAllow) {
            return actualFunc.apply(thisArg, args);
          }
        }
      }

      return actualFunc.apply(thisArg, args);
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

      const nodeModulesRoot = stackEntry.lastIndexOf("node_modules");

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

    function logIssue(message) {
      // We do the actual logging in a setTimeout so that it occurs in a different stack frame.
      setTimeout(() => {
        opts.violationLogger(message);
      }, 1);
    }

    // This goes through each of the privileged modules and wraps all the functions within
    for (const privilegeId in privilegeModules) {
      const privilegedModule = privilegeModules[privilegeId];

      for (const key in privilegedModule) {
        if (
          privilegedModule.hasOwnProperty(key) &&
          typeof privilegedModule[key] == "function"
        ) {
          const actualFunc = privilegedModule[key];

          if (actualFunc.constructor.name === "AsyncFunction") {
            privilegedModule[key] = async function () {
              const stackString = new Error().stack;

              return await doFunctionCall(
                privilegeId,
                actualFunc,
                stackString,
                this,
                Array.from(arguments)
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
                Array.from(arguments)
              );
            };
          }

          privilegedModule[key].prototype = actualFunc.prototype;
        }
      }
    }
  },
};
