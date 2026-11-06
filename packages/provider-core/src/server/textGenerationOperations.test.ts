import { describe, expect, it } from "@effect/vitest";
import { ProviderInstanceId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { decodeJsonReply, fromRunner } from "./textGenerationOperations.ts";

describe("thread title preservation", () => {
  it.effect(
    "keeps an accurate formatted title when the model also returns a cosmetic paraphrase",
    () =>
      Effect.gen(function* () {
        const generator = fromRunner("test", (request) =>
          decodeJsonReply(
            request,
            "test",
            JSON.stringify({
              title: "快捷键 - 终端焦点",
              needsRefinement: false,
              preservePreviousTitle: true,
            }),
          ).pipe(Effect.orDie),
        );
        const result = yield* generator.generateThreadTitle({
          cwd: "/repo",
          message: "修复终端快捷键的焦点问题。",
          previousTitle: "快捷键 - 终端焦点修复",
          modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "test" },
        });
        expect(result.title).toBe("快捷键 - 终端焦点修复");
      }),
  );

  it.effect(
    "can replace unknown, unformatted, or inaccurate titles and generate the first title",
    () =>
      Effect.gen(function* () {
        for (const previousTitle of [
          undefined,
          "修复终端焦点",
          "待定 - 排查焦点",
          "快捷键 - 旧目标",
        ]) {
          const generator = fromRunner("test", (request) =>
            decodeJsonReply(
              request,
              "test",
              JSON.stringify({
                title: "快捷键 - 终端焦点修复",
                needsRefinement: false,
                preservePreviousTitle: previousTitle !== "快捷键 - 旧目标",
              }),
            ).pipe(Effect.orDie),
          );
          const result = yield* generator.generateThreadTitle({
            cwd: "/repo",
            message: "修复终端快捷键的焦点问题。",
            ...(previousTitle === undefined ? {} : { previousTitle }),
            modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "test" },
          });
          expect(result.title).toBe("快捷键 - 终端焦点修复");
        }
      }),
  );
});
