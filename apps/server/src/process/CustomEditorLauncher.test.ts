import { assert, it } from "@effect/vitest";
import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as HostProcess from "@t3tools/shared/HostProcess";

import * as ServerSettings from "../serverSettings.ts";
import * as CustomEditorLauncher from "./CustomEditorLauncher.ts";

it.effect(
  "runs only saved open commands on the host with an intact cwd and sanitized environment",
  () =>
    Effect.gen(function* () {
      const spawned: Array<ChildProcess.StandardCommand> = [];
      let unreferenced = 0;
      const spawner = ChildProcessSpawner.make((command) => {
        assert.isTrue(ChildProcess.isStandardCommand(command));
        if (!ChildProcess.isStandardCommand(command))
          return Effect.die("Expected a standard command");
        spawned.push(command);
        return Effect.succeed(
          ChildProcessSpawner.makeHandle({
            pid: ChildProcessSpawner.ProcessId(1),
            exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
            isRunning: Effect.succeed(true),
            kill: () => Effect.void,
            unref: Effect.sync(() => {
              unreferenced++;
              return Effect.void;
            }),
            stdin: Sink.drain,
            stdout: Stream.empty,
            stderr: Stream.empty,
            all: Stream.empty,
            getInputFd: () => Sink.drain,
            getOutputFd: () => Stream.empty,
          }),
        );
      });
      let editors = [{ id: "custom", name: "My editor", command: 'my-editor "$T3CODE_CWD"' }];
      const layer = CustomEditorLauncher.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            NodeServices.layer,
            Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
            Layer.mock(ServerSettings.ServerSettingsService)({
              getSettings: Effect.sync(() => ({
                ...DEFAULT_SERVER_SETTINGS,
                customOpenIn: editors,
              })),
            }),
          ),
        ),
      );
      yield* Effect.gen(function* () {
        const launcher = yield* CustomEditorLauncher.CustomEditorLauncher;
        const cwd = "/workspace/a space/$(do-not-run)";
        yield* launcher.open({ id: "custom", cwd });
        assert.equal(spawned.length, 1);
        assert.equal(spawned[0]?.command, editors[0]?.command);
        assert.equal(spawned[0]?.options.cwd, cwd);
        assert.equal(spawned[0]?.options.shell, true);
        assert.equal(spawned[0]?.options.env?.T3CODE_CWD, cwd);
        assert.isUndefined(spawned[0]?.options.env?.ELECTRON_RUN_AS_NODE);
        assert.equal(unreferenced, 1);
        editors = [{ id: "custom", name: "Changed editor", command: "changed-editor ." }];
        yield* launcher.open({ id: "custom", cwd });
        assert.equal(spawned[1]?.command, "changed-editor .");
        editors = [];
        const missing = yield* launcher.open({ id: "custom", cwd }).pipe(Effect.flip);
        assert.equal(missing._tag, "CustomEditorLaunchError");
        assert.equal(spawned.length, 2);
      }).pipe(Effect.provide(layer));
    }).pipe(
      Effect.provideService(HostProcess.Environment, { PATH: "/bin", ELECTRON_RUN_AS_NODE: "1" }),
    ),
);
