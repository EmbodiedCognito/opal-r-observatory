import type { Dataset } from "../types";
import { wrapForConsole } from "./rCode";

interface WebRInstance {
  init(): Promise<void>;
  evalRString(code: string): Promise<string>;
  version: string;
  versionR: string;
}

interface WebRConstructor {
  new (): WebRInstance;
}

const WEBR_MODULE = "https://webr.r-wasm.org/v0.6.0/webr.mjs";
let runtimePromise: Promise<WebRInstance> | null = null;

export async function getWebR() {
  if (!runtimePromise) {
    runtimePromise = import(/* @vite-ignore */ WEBR_MODULE).then(async (module) => {
      const WebR = module.WebR as WebRConstructor;
      const runtime = new WebR();
      await runtime.init();
      return runtime;
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
