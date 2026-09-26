import type { Dataset } from "../types";
import { wrapForConsole } from "./rCode";

interface WebRInstance {
  init(): Promise<void>;
  evalRString(code: string): Promise<string>;
  version: string;
  versionR: string;
}

interface WebRConstructor {
  new (options: { baseUrl: string }): WebRInstance;
}

const WEBR_MODULE = "/webr/webr.mjs";
let runtimePromise: Promise<WebRInstance> | null = null;

export async function getWebR() {
  if (!runtimePromise) {
    runtimePromise = import(/* @vite-ignore */ WEBR_MODULE).then(async (module) => {
      const WebR = module.WebR as WebRConstructor;
      const runtime = new WebR({ baseUrl: new URL("/webr/", window.location.origin).href });
      await runtime.init();
      return runtime;
    }).catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

export async function runAnalysis(dataset: Dataset, rCode: string) {
  const runtime = await getWebR();
  const output = await runtime.evalRString(wrapForConsole(dataset, rCode));
  return {
    output: output.trim() || "Analysis completed without console output.",
    runtime: `webR ${runtime.version} · R ${runtime.versionR}`,
  };
}
