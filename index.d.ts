// Type definitions for ByrnesJS 0.1.x
// Project: ByrnesJS

interface ByrnesJsLogger {
    debug: (msg: string) => void,
    info: (msg: string) => void,
    warn: (msg: string) => void,
    error: (msg: string) => void
}

interface ByrnesJsAllowDeclaration {
    module: string | string[],
    privileges: string | string[],
    alwaysAllow?: boolean
}

interface ByrnesJsOptions {
    rootDir: string,
    logOnly?: boolean,
    logger?: ByrnesJsLogger,
    logOnlyStack?: boolean,
    violationLogger?: (msg: string) => void,
    allow: ByrnesJsAllowDeclaration[],
}

export function init(options: ByrnesJsOptions): void;

export const PRIV_ALL: string;
export const PRIV_FILESYSTEM: string;
export const PRIV_NETWORK: string;
export const PRIV_CHILD_PROCESS: string;
export const PRIV_VM: string;
export const PRIV_DGRAM: string;
export const PRIV_DNS: string;
export const PRIV_WORKER_THREADS: string;
export const PRIV_PROCESS: string;