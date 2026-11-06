import {
  AuthOrchestrationOperateScope,
  EnvironmentId,
  type CustomOpenIn,
  type EditorId,
} from "@t3tools/contracts";
import { DEFAULT_RESOLVED_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { Cause } from "effect";
import { AsyncResult } from "effect/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";

import { act, fakeTimers, render as renderUi } from "../../../test/render";
import type { RemoteOpenState } from "../../remoteOpen";

const state = vi.hoisted(() => ({
  allowed: new Set<string>(),
  remote: { mode: "local-exec" } as RemoteOpenState,
  clientEditors: ["vscode"] as readonly EditorId[],
  run: vi.fn(),
  openUrl: vi.fn(),
  setPreferred: vi.fn(),
  markHintSeen: vi.fn(),
  listeners: new Set<() => void>(),
  customEditors: [] as CustomOpenIn[],
}));

vi.mock(import("../../state/session"), async (importOriginal) => {
  const { useSyncExternalStore } = await import("react");
  const readEnvironmentScope = (environmentId: string, scope: string) =>
    scope === AuthOrchestrationOperateScope && state.allowed.has(environmentId);
  return {
    ...(await importOriginal()),
    readEnvironmentScope: readEnvironmentScope as never,
    useEnvironmentScope: ((environmentId: string, scope: string) =>
      useSyncExternalStore(
        (listener) => {
          state.listeners.add(listener);
          return () => state.listeners.delete(listener);
        },
        () => readEnvironmentScope(environmentId, scope),
      )) as never,
  };
});
vi.mock(import("../../state/use-atom-command"), async (importOriginal) => ({
  ...(await importOriginal()),
  useAtomCommand: (() => state.run) as never,
}));
vi.mock(import("../../state/environments"), async (importOriginal) => ({
  ...(await importOriginal()),
  useEnvironment: (() => ({
    label: "Test host",
    serverConfig: { settings: { customOpenIn: state.customEditors } },
  })) as never,
}));
vi.mock(import("../../state/shell"), async (importOriginal) => {
  const { Atom } = await import("effect/reactivity");
  const actual = await importOriginal();
  return {
    ...actual,
    shellEnvironment: {
      ...actual.shellEnvironment,
      openInCustomEditor: {
        ...actual.shellEnvironment.openInCustomEditor,
        permissionAtom: (id: EnvironmentId | null) =>
          Atom.make(id !== null && state.allowed.has(id)),
      },
    },
  };
});
vi.mock(import("../../editorPreferences"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    usePreferredEditor: (available: readonly EditorId[]) => {
      const [preferred, setPreferred] = actual.usePreferredEditor(available);
      const recordPreferred: typeof setPreferred = (editor) => {
        state.setPreferred(editor);
        setPreferred(editor);
      };
      return [preferred, recordPreferred] as const;
    },
  };
});
vi.mock(import("../../remoteOpen"), async (importOriginal) => ({
  ...(await importOriginal()),
  useRemoteOpenState: () => state.remote,
  useRemoteCapableEditors: () => state.clientEditors,
  useRemoteOpenHint: () => [false, state.markHintSeen] as const,
  openRemoteEditorUrl: state.openUrl,
}));

import { OpenInPicker } from "./OpenInPicker";
import {
  registerOpenFavoriteEditorCommand,
  useOpenFavoriteEditorShortcut,
} from "./OpenInPickerShortcut";

const primary = EnvironmentId.make("primary");
const selected = EnvironmentId.make("selected");
const editors: readonly EditorId[] = ["vscode"];

async function setup() {
  state.allowed.clear();
  state.remote = { mode: "local-exec" };
  state.clientEditors = editors;
  state.run.mockReset().mockResolvedValue(AsyncResult.success(undefined));
  state.openUrl.mockReset().mockResolvedValue(true);
  state.setPreferred.mockReset();
  state.markHintSeen.mockReset();
  state.listeners.clear();
  state.customEditors = [];
  window.localStorage.clear();

  await using stack = new AsyncDisposableStack();
  const _platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux");
  stack.use(_platform);
  const _storage = { [Symbol.dispose]: () => window.localStorage.clear() };
  stack.use(_storage);
  // The app registers this command at startup (appInit).
  const _openFavorite = { [Symbol.dispose]: registerOpenFavoriteEditorCommand() };
  stack.use(_openFavorite);
  const screen = stack.use(await renderUi(null));
  async function renderPicker(
    availableEditors: readonly EditorId[] = editors,
    panel = false,
    { openInCwd = "/work/project", revealFileManager = false } = {},
  ) {
    await act(async () => {
      for (const listener of state.listeners) listener();
      const node = (
        <OpenInPicker
          environmentId={selected}
          keybindings={DEFAULT_RESOLVED_KEYBINDINGS}
          availableEditors={availableEditors}
          openInCwd={openInCwd}
          revealFileManager={revealFileManager}
          displayMode={panel ? "panel" : "toolbar"}
          compact={!panel}
        />
      );
      await screen.rerender(node);
    });
  }

  function byLabel(label: string) {
    const element = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    expect(element, label).not.toBeNull();
    return element!;
  }

  const primaryButton = () => byLabel("Open file in preferred editor");
  const menuItems = () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];

  async function click(element: HTMLElement) {
    await act(async () => element.click());
  }

  async function pressOpenFavorite(mac = false) {
    const event = new KeyboardEvent("keydown", {
      key: "o",
      ctrlKey: !mac,
      metaKey: mac,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => document.body.dispatchEvent(event));
    return event;
  }

  function FavoriteEditorFallback() {
    useOpenFavoriteEditorShortcut({
      enabled: true,
      environmentId: selected,
      keybindings: DEFAULT_RESOLVED_KEYBINDINGS,
      availableEditors: editors,
      openInCwd: "/work/project",
    });
    return null;
  }

  const environment = stack.move();
  return {
    screen,
    renderPicker,
    byLabel,
    primaryButton,
    menuItems,
    click,
    pressOpenFavorite,
    FavoriteEditorFallback,
    [Symbol.asyncDispose]: () => environment.disposeAsync(),
  };
}

describe("host editor access", () => {
  it("runs configured commands on the selected host with intact worktree paths and updates the menu", async () => {
    await using fixture = await setup();
    const { renderPicker, byLabel, click, menuItems } = fixture;
    state.allowed.add(selected);
    state.customEditors = [{ id: "custom", name: "My editor", command: "editor ." }];
    for (const remote of [
      { mode: "local-exec" },
      { mode: "remote-links", host: { kind: "ssh-alias", host: "remote" } },
      { mode: "remote-unavailable" },
    ] as const) {
      state.remote = remote;
      await renderPicker(editors, false, { openInCwd: "/worktree with spaces" });
      await click(byLabel("Choose editor"));
      await vi.waitFor(() =>
        expect(
          menuItems().some((item) => item.textContent?.includes("My editor · Run on Test host")),
        ).toBe(true),
      );
      const item = menuItems().find((item) =>
        item.textContent?.includes("My editor · Run on Test host"),
      )!;
      await click(item);
      expect(state.run).toHaveBeenLastCalledWith({
        environmentId: selected,
        input: { id: "custom", cwd: "/worktree with spaces" },
      });
      expect(state.openUrl).not.toHaveBeenCalled();
    }
    state.customEditors = [{ id: "custom", name: "Updated editor", command: "other ." }];
    await renderPicker();
    await click(byLabel("Choose editor"));
    await vi.waitFor(() =>
      expect(menuItems().some((item) => item.textContent?.includes("Updated editor"))).toBe(true),
    );
    state.customEditors = [];
    await renderPicker(editors, false, { openInCwd: "/work/other-project" });
    expect(menuItems().some((item) => item.textContent?.includes("Updated editor"))).toBe(false);
  });

  it("disables custom host execution without the selected grant while preserving remote editor links", async () => {
    await using fixture = await setup();
    const { renderPicker, byLabel, click, menuItems } = fixture;
    state.allowed.add(primary);
    state.customEditors = [{ id: "custom", name: "My editor", command: "editor ." }];
    state.remote = { mode: "remote-links", host: { kind: "ssh-alias", host: "remote" } };
    await renderPicker();
    await click(byLabel("Choose editor"));
    await vi.waitFor(() =>
      expect(menuItems().some((item) => item.textContent?.includes("My editor"))).toBe(true),
    );
    expect(menuItems().find((item) => item.textContent?.includes("My editor"))).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(menuItems().find((item) => item.textContent?.includes("VS Code"))).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(state.run).not.toHaveBeenCalled();
  });

  it("uses the selected grant for both the button and a retained shortcut", async () => {
    await using fixture = await setup();
    const { renderPicker, byLabel, primaryButton, click, pressOpenFavorite } = fixture;
    state.allowed.add(selected);
    await renderPicker();
    // Revoke without rerendering to exercise execution-time grant checks.
    state.allowed.delete(selected);
    state.allowed.add(primary);
    await click(primaryButton());
    // The shortcut is consumed and opens nothing once the grant is gone.
    expect((await pressOpenFavorite()).defaultPrevented).toBe(true);
    expect(state.run).not.toHaveBeenCalled();
    expect(state.setPreferred).not.toHaveBeenCalled();

    await renderPicker();
    expect(primaryButton().disabled).toBe(true);
    expect(byLabel("Choose editor").disabled).toBe(true);
    expect((await pressOpenFavorite()).defaultPrevented).toBe(false);
  });
});

describe("remote editor links", () => {
  it("opens the link from the fallback when the picker is not mounted", async () => {
    await using fixture = await setup();
    const { screen, pressOpenFavorite, FavoriteEditorFallback } = fixture;
    state.remote = { mode: "remote-links", host: { kind: "ssh-alias", host: "sol" } };
    await act(async () => screen.rerender(<FavoriteEditorFallback />));

    expect((await pressOpenFavorite()).defaultPrevented).toBe(true);
    expect(state.openUrl).toHaveBeenCalledWith(expect.stringContaining("ssh-remote+sol"));
    expect(state.run).not.toHaveBeenCalled();
  });
});

describe("open in editor announcement", () => {
  it("speaks only after the shortcut opened the editor, from the picker or the fallback", async () => {
    await using fixture = await setup();
    const { screen, renderPicker, pressOpenFavorite, FavoriteEditorFallback } = fixture;
    state.allowed.add(selected);
    await renderPicker();
    using _timers = fakeTimers();
    const regions = () => [...document.querySelectorAll('body > [aria-live="polite"]')];
    const spoken = async () => {
      await act(async () => vi.runAllTimers());
      return regions()
        .map((region) => region.textContent)
        .join("");
    };
    const refuse = () =>
      state.run.mockResolvedValueOnce(AsyncResult.failure(Cause.fail(new Error("No editor"))));

    refuse();
    await pressOpenFavorite();
    expect(await spoken()).toBe("");
    await pressOpenFavorite();
    expect(await spoken()).toBe("Opened in VS Code");

    for (const region of regions()) region.textContent = "";
    await act(async () => screen.rerender(<FavoriteEditorFallback />));
    refuse();
    await pressOpenFavorite();
    expect(await spoken()).toBe("");
    await pressOpenFavorite();
    expect(await spoken()).toBe("Opened in VS Code");
  });
});
