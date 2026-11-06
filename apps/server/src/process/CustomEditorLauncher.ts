import { CustomEditorLaunchError, type LaunchCustomEditorInput } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/process";

import * as ServerSettings from "../serverSettings.ts";
import { launchCustomEditorCommand } from "./externalLauncher.ts";

export class CustomEditorLauncher extends Context.Service<
  CustomEditorLauncher,
  {
    readonly open: (input: LaunchCustomEditorInput) => Effect.Effect<void, CustomEditorLaunchError>;
  }
>()("t3/process/CustomEditorLauncher") {}

const make = Effect.gen(function* () {
  const settings = yield* ServerSettings.ServerSettingsService;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return CustomEditorLauncher.of({
    open: Effect.fn("CustomEditorLauncher.open")(function* (input) {
      const current = yield* settings.getSettings.pipe(
        Effect.mapError(
          (cause) =>
            new CustomEditorLaunchError({
              id: input.id,
              detail: "Could not read custom open commands.",
              cause,
            }),
        ),
      );
      const editor = current.customOpenIn.find((candidate) => candidate.id === input.id);
      if (!editor)
        return yield* new CustomEditorLaunchError({
          id: input.id,
          detail: "This custom open command no longer exists.",
        });
      yield* launchCustomEditorCommand({ ...input, command: editor.command }).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
      );
    }),
  });
});

export const layer = Layer.effect(CustomEditorLauncher, make);
