# ByrnesJS

Package Sandboxing for NodeJS

When we build a NodeJS application we pull in all kinds of package dependencies to help us with all kinds of things. But how do we know that they are really doing what we think they're doing? How do you know that one of the 73 query string parsing packages you've included isn't secretly harvesting passwords and sending them to a malicious server somewhere? The fact is that unless you inspect every bit of code you import then you can't be sure.

Most packages have no need for any privileged access to the network or filesystem, so what if we could stop them having access, and only give access to the libraries that really need them?

For example, that query string parsing package doesn't need to access the network, the filesystem, or the shell, so let's just prevent it doing so.

This is where package sandboxing can help.

ByrnesJS is a library for NodeJS which will prevent any code accessing privileged operations, except for certain packages which you explicitly allow.

It allows to you only give permissions to access the filesystem, network, or shell to those libraries which should be accessing them. If a library tries to access something which hasn't been given permission to access then that access will be denied.

> :warning: **Note that this is experimental software. Its stability, efficacy, and performance have yet to be tested.** Feel free to try it out though and raise a ticket or PR if you have any issues or suggestions.

## Prerequisites

**This library currently only supports Node 12.x and above**

## Installation

### yarn

```bash
yarn add byrnesjs
```

### npm

```bash
npm install --save byrnesjs
```

## Usage

Calling init() on ByrnesJS SHOULD be the first thing your program does, before it loads any other libraries.

```js
const byrnesjs = require("byrnesjs");

byrnesjs.init({
  rootDir: __dirname,
  logOnly: false,
  allow: [
    {
      module: "/", // This will trust all code in the current project (excluding node_modules). You probably always want this (you trust your own code, right?!).
      privileges: byrnesjs.PRIV_ALL, // This means all privileges
    },
    {
      module: "node_modules/somethingtrusted",
      privileges: byrnesjs.PRIV_FILESYSTEM, // This is trusted to only use the filesystem
    },
    {
      module: ["node_modules/somethingelsetrusted", "node_modules/anotherlib/"],
      privileges: [
        // These are trusted to use both the network and shell
        byrnesjs.PRIV_NETWORK,
        byrnesjs.PRIV_CHILD_PROCESS,
      ],
    },
  ],
});
```

## Options

| Option          | Type     | Example                             | Default         | Description                                                                                                |
| --------------- | -------- | ----------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| rootDir         | String   | `__dirname`                         | \<required>     | This is the root directory which will be used for path based allow entries.                                |
| logOnly         | boolean  | `true`                              | `false`         | If set to `true` then any violations will only be logged. If `false` then violations will throw an `Error` |
| violationLogger | function | `(message) => console.log(message)` | `console.error` | A callback function to which violation messages will be sent.                                              |
| allow           | Array    | _\<see usage example>_              | `[]`            | Sets the list of trusted libraries (and code) - see below                                                  |

### Allow

This is the list of options within a definition within the 'allow' array

| Option      | Type            | Example                                | Default     | Description                                                                                                                                                                                                                                                                                                                                         |
| ----------- | --------------- | -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| module      | String \| Array | `['/', 'node_modules/trustedmodule/']` | \<required> | Either a single string or array of strings to specify the module to allow. If it begins with `node_modules` then it is treated specially and will apply to that module. Otherwise it points to a path relative to `rootDir`.                                                                                                                        |
| privileges  | String \| Array | `['fs', 'net]`                         | \<required> | Defines the privileges to be allowed. Should either be the string `'*'` which means allow all privileges, or an array containing one or more of the privileged module names: `net`, `fs`, or `child_process`                                                                                                                                        |
| alwaysAllow | boolean         | `true`                                 | `false`     | Normally the entire call stack needs to be trusted in order for the call to be allowed. However, if one of the entries has `alwaysAllow` set to `true` then the call will be allowed even if there are untrusted entries further down the stack. This should be used sparingly as it allows a path for untrusted code to call privileged functions. |

### Controlled Privileges

The privileges to which access can be controlled are:

| Module          | Module ID        | Indeintifier          | Description                                                                                                                                                                 |
| --------------- | ---------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File System     | `fs`             | `PRIV_FILESYSTEM`     | The fs module provides an API for interacting with the file system.                                                                                                         |
| Network         | `net`            | `PRIV_NETWORK`        | The net module provides an asynchronous network API for creating stream-based TCP or IPC servers and clients.                                                               |
| Child Processes | `child_process`  | `PRIV_CHILD_PROCESS`  | The child_process module provides the ability to spawn child processes.                                                                                                     |
| Virtual Machine | `vm`             | `PRIV_VM`             | The vm module enables compiling and running code within V8 Virtual Machine contexts.                                                                                        |
| UDP/Datagram    | `dgram`          | `PRIV_DGRAM`          | The dgram module provides an implementation of UDP Datagram sockets.                                                                                                        |
| DNS             | `dns`            | `PRIV_DNS`            | The dns module enables name resolution.                                                                                                                                     |
| Worker Threads  | `worker_threads` | `PRIV_WORKER_THREADS` | The worker_threads module enables the use of threads that execute JavaScript in parallel.                                                                                   |
| Process         | `process`        | `PRIV_PROCESS`        | The process object is a global that provides information about, and control over, the current Node.js process. Note that only some functions are overridden on this object. |

Note that when granting `PRIV_NETWORK` you will likely (but not necessarily) need to grant `PRIV_DNS` too, and vice versa.

## How it works

ByrnesJS works by wrapping all the functions within the privileged modules with code which will check the caller of that function.

When one of those functions is called ByrnesJS will check the entire call stack to ensure that all of the code paths within the stack are allowed to call that privileged function.

## Limitations

Due to being implemented as a pure Javascript library there are certain limitations to the current implementation:

- Packages can include native code which can't be intercepted by this library. This would require some deeper support in the VM or OS to intercept.
- While I think I've covered all the bases, because it's implemented at a high level there may be some ways I've missed for mailicious code to get hold of the original non-overidden functions. If you spot any ways around it then please raise an issue!
- Some packages run scripts at the install stage (unsing the preinstall and postinstall scripts). Because ByrnesJS currently only runs at runtime it won't sandbox these scripts. You can use the `--ignore-scripts` flag on yarn or npm to prevent these scripts running but that will probably break stuff!

## Why "ByrnesJS?"

Like Jack Byrnes, it allows you to only bring those libraries you really trust into your 'Circle of Trust'. https://www.google.com/search?q=jack+byrnes+circle+of+trust

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

> :exclamation: ByrnesJS deliberately doesn't use any non-dev dependencies, so if you do want to contribute please don't add any!

## License

[MIT](https://choosealicense.com/licenses/mit/)
