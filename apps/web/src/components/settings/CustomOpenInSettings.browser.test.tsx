import { EnvironmentId, type CustomOpenIn } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "../../../test/render";
import { page } from "vite-plus/test/browser";
import "~/index.css";

const state = vi.hoisted(() => ({ editors: [] as CustomOpenIn[], save: vi.fn(), allowed: true }));
vi.mock(import("./SettingsScopeContext"), async () => {
  const { DEFAULT_SERVER_SETTINGS, EnvironmentId } = await import("@t3tools/contracts");
  return {
    useSettingsScope: (() => ({
      scope: { kind: "environment" },
      targets: [{}],
      target: {
        environmentId: EnvironmentId.make("host"),
        settings: { ...DEFAULT_SERVER_SETTINGS, customOpenIn: state.editors },
      },
    })) as never,
  };
});
vi.mock(import("./useScopedSettings"), () => ({
  useScopedSettingsWriteAllowed: () => state.allowed,
}));
vi.mock(import("../../state/environments"), async (original) => ({
  ...(await original()),
  useEnvironment: () => ({ label: "Dev Mac" }) as never,
}));
vi.mock(import("../../state/use-atom-command"), () => ({ useAtomCommand: () => state.save }));
vi.mock(import("./SettingsScopeNotice"), () => ({ SettingsScopeNotice: () => <div /> }));
vi.mock(import("./settingsLayout"), () => ({
  SettingsRow: (({
    title,
    description,
    control,
  }: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    control?: React.ReactNode;
  }) => (
    <div>
      {title}
      {description}
      {control}
    </div>
  )) as never,
  SettingsSection: (({ title, children }: { title: string; children?: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  )) as never,
}));

import { CustomOpenInSettings } from "./CustomOpenInSettings";

function setup() {
  state.editors = [];
  state.allowed = true;
  state.save
    .mockReset()
    .mockImplementation(async (request: { input: { patch: { customOpenIn: CustomOpenIn[] } } }) => {
      state.editors = request.input.patch.customOpenIn;
      return AsyncResult.success(undefined);
    });
}

describe("custom open settings", () => {
  it("adds, edits and deletes an environment command without choosing a project", async () => {
    setup();
    await using screen = await render(<CustomOpenInSettings />);
    await screen.getByRole("button", { name: "Add open command" }).click();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("My editor");
    await page
      .getByRole("textbox", { name: "Launch command", exact: true })
      .fill('open -a "My Editor" "$T3CODE_CWD"');
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.element(screen.getByRole("button", { name: "Edit My editor" })).toBeVisible();
    expect(state.save).toHaveBeenLastCalledWith({
      environmentId: EnvironmentId.make("host"),
      input: {
        patch: {
          customOpenIn: [
            expect.objectContaining({
              name: "My editor",
              command: 'open -a "My Editor" "$T3CODE_CWD"',
            }),
          ],
        },
      },
    });
    const id = state.editors[0]?.id;
    await screen.getByRole("button", { name: "Edit My editor" }).click();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Updated editor");
    await page.getByRole("textbox", { name: "Launch command", exact: true }).fill("other-editor .");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.element(screen.getByRole("button", { name: "Edit Updated editor" })).toBeVisible();
    expect(state.editors).toEqual([{ id, name: "Updated editor", command: "other-editor ." }]);
    await screen.getByRole("button", { name: "Edit Updated editor" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect
      .element(screen.getByRole("button", { name: "Edit Updated editor" }))
      .not.toBeInTheDocument();
    expect(state.save).toHaveBeenLastCalledWith({
      environmentId: EnvironmentId.make("host"),
      input: { patch: { customOpenIn: [] } },
    });
  });
});
