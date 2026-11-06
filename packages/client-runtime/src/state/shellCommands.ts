import { WS_METHODS } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

import { createEnvironmentRpcCommand } from "./runtime.ts";
import type { EnvironmentRegistry } from "../connection/registry.ts";

export function createShellEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  return {
    openInCustomEditor: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:shell:open-in-custom-editor",
      tag: WS_METHODS.shellOpenInCustomEditor,
    }),
    openInEditor: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:shell:open-in-editor",
      tag: WS_METHODS.shellOpenInEditor,
    }),
  };
}
