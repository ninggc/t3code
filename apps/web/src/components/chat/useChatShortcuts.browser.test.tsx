import type { KeybindingCommand, ResolvedKeybindingsConfig } from "@t3tools/contracts";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { surfaceShortcutKey } from "~/lib/surfaceShortcutKey";
import { registerCommands } from "~/shortcuts/dispatcher";
import { render } from "../../../test/render";
import type { ChatComposerHandle } from "./ChatComposer";
import { useChatShortcuts } from "./useChatShortcuts";

const shortcutContext = {
  terminalFocus: false,
  terminalOpen: false,
  previewFocus: false,
  previewOpen: false,
  isWeb: true,
  isDesktop: false,
  modelPickerOpen: false,
};

const focusOnMount = (element: HTMLElement | null) => element?.focus();

// Stands in for the right panel's launcher, which needs the whole app around it. Like the
// real one it takes focus, advertises its letters in `data-surface-launcher-keys`, and
// claims one from its own window capture listener unless the key was already handled.
function Launcher(props: { keys: string; received: string[] }) {
  useEffect(() => {
    const claim = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const key = surfaceShortcutKey(event);
      if (key === null || !props.keys.toLowerCase().includes(key)) return;
      event.preventDefault();
      props.received.push(event.key);
    };
    window.addEventListener("keydown", claim, true);
    return () => window.removeEventListener("keydown", claim, true);
  }, [props.keys, props.received]);
  return (
    <div
      ref={focusOnMount}
      tabIndex={0}
      aria-label="Open a surface"
      data-surface-launcher-keys={props.keys}
    />
  );
}

// The chat's shortcut listener registers when the chat mounts, so a launcher that opens
// later registers after it. Tests mount the chat first and add the launcher by rerendering.
function Chat(props: { composerKeys: string[]; launcher?: { keys: string; received: string[] } }) {
  useChatShortcuts({
    enabled: true,
    keybindings: [],
    scriptKeybindings: [],
    getShortcutContext: () => shortcutContext,
    threadFindActive: false,
    // Type-to-focus only calls insertTextAtEnd, so the stand-in composer implements just that.
    composerRef: {
      current: {
        insertTextAtEnd: (key: string) => {
          props.composerKeys.push(key);
          return true;
        },
      } as Partial<ChatComposerHandle> as ChatComposerHandle,
    },
    branchToolbarRef: { current: null },
    closeThreadFind: () => {},
    focusComposer: () => {},
    commands: {},
    fallback: () => undefined,
  });
  return props.launcher ? <Launcher {...props.launcher} /> : null;
}

// router: false because the chat shortcuts and the launcher stand-in never navigate.
const options = { router: false } as const;

it("leaves the launcher's letters to the launcher, in either case", async () => {
  const composerKeys: string[] = [];
  const received: string[] = [];
  await using screen = await render(<Chat composerKeys={composerKeys} />, options);
  await screen.rerender(<Chat composerKeys={composerKeys} launcher={{ keys: "BT", received }} />);

  await userEvent.keyboard("tT");

  expect(received).toEqual(["t", "T"]);
  expect(composerKeys).toEqual([]);
});

it("still types other letters into the composer while the launcher is open", async () => {
  const composerKeys: string[] = [];
  const received: string[] = [];
  await using screen = await render(<Chat composerKeys={composerKeys} />, options);
  await screen.rerender(<Chat composerKeys={composerKeys} launcher={{ keys: "BT", received }} />);

  await userEvent.keyboard("a");

  expect(composerKeys).toEqual(["a"]);
  expect(received).toEqual([]);
});

it("leaves a non-Latin launcher letter to the launcher by its physical key", async () => {
  const composerKeys: string[] = [];
  const received: string[] = [];
  await using screen = await render(<Chat composerKeys={composerKeys} />, options);
  await screen.rerender(<Chat composerKeys={composerKeys} launcher={{ keys: "BT", received }} />);

  // Playwright cannot press a key its US layout lacks, so send what a Ukrainian T key sends.
  const event = new KeyboardEvent("keydown", {
    key: "\u0435",
    code: "KeyT",
    bubbles: true,
    cancelable: true,
  });
  (document.activeElement ?? document.body).dispatchEvent(event);

  expect(composerKeys).toEqual([]);
  expect(received).toEqual(["\u0435"]);
});

it.each([
  { key: "b", code: "KeyN", composer: [], launcher: ["b"] },
  { key: "x", code: "KeyB", composer: ["x"], launcher: [] },
  { key: "è", code: "KeyT", composer: ["è"], launcher: [] },
])("routes $key on $code by the typed letter", async ({ key, code, composer, launcher }) => {
  const composerKeys: string[] = [];
  const received: string[] = [];
  await using screen = await render(<Chat composerKeys={composerKeys} />, options);
  await screen.rerender(<Chat composerKeys={composerKeys} launcher={{ keys: "BT", received }} />);

  const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(event);

  expect(composerKeys).toEqual(composer);
  expect(received).toEqual(launcher);
});

const ctrlShift = (key: string, command: KeybindingCommand) => ({
  command,
  shortcut: { key, metaKey: false, ctrlKey: true, shiftKey: true, altKey: false, modKey: false },
});
const sideChatKeybindings: ResolvedKeybindingsConfig = [
  ctrlShift("m", "modelPicker.toggle"),
  ctrlShift("x", "thread.stop"),
];

// A side chat in the main chat's panel: no window listeners, only its composer's own chords.
function SideChat(props: { toggles: string[]; stops: string[] }) {
  const [composerElement, setComposerElement] = useState<HTMLDivElement | null>(null);
  useChatShortcuts({
    enabled: false,
    embedded: true,
    composerElement,
    keybindings: sideChatKeybindings,
    scriptKeybindings: [],
    getShortcutContext: () => shortcutContext,
    threadFindActive: false,
    composerRef: {
      current: {
        toggleModelPicker: () => props.toggles.push("model"),
      } as Partial<ChatComposerHandle> as ChatComposerHandle,
    },
    branchToolbarRef: { current: null },
    closeThreadFind: () => {},
    focusComposer: () => {},
    commands: { "thread.stop": () => void props.stops.push("stop") },
    fallback: () => undefined,
  });
  return (
    <>
      <div ref={setComposerElement}>
        <textarea aria-label="Side chat composer" />
      </div>
      <textarea aria-label="Main composer" />
    </>
  );
}

it("runs a side chat's composer chords only from its composer, and never thread commands", async () => {
  const toggles: string[] = [];
  const stops: string[] = [];
  await using screen = await render(<SideChat toggles={toggles} stops={stops} />, options);

  await userEvent.click(screen.getByLabelText("Side chat composer"));
  await userEvent.keyboard("{Control>}{Shift>}MX{/Shift}{/Control}");
  await userEvent.click(screen.getByLabelText("Main composer"));
  await userEvent.keyboard("{Control>}{Shift>}M{/Shift}{/Control}");

  expect(toggles).toEqual(["model"]);
  expect(stops).toEqual([]);
});

function EscapeChat(props: {
  name?: string;
  embedded?: boolean;
  enabled?: boolean;
  findActive?: boolean;
  modelPickerOpen?: boolean;
  events?: string[];
  children?: ReactNode;
}) {
  const name = props.name ?? "Main";
  const editor = useRef<HTMLTextAreaElement>(null);
  const [composerElement, setComposerElement] = useState<HTMLDivElement | null>(null);
  const focusComposer = () => {
    props.events?.push(`focus:${name}`);
    editor.current?.focus();
    editor.current?.setSelectionRange(editor.current.value.length, editor.current.value.length);
  };
  useChatShortcuts({
    enabled: props.embedded ? false : (props.enabled ?? true),
    embedded: props.embedded === true,
    composerElement,
    keybindings: [],
    scriptKeybindings: [],
    getShortcutContext: (target) => ({
      ...shortcutContext,
      composerFocus: target === editor.current,
      modelPickerOpen: props.modelPickerOpen ?? false,
    }),
    threadFindActive: props.findActive ?? false,
    composerRef: { current: null },
    branchToolbarRef: { current: null },
    closeThreadFind: () => {
      props.events?.push(`find:${name}`);
      focusComposer();
    },
    focusComposer,
    commands: {},
    fallback: () => undefined,
  });
  return (
    <section data-side-chat-pane={props.embedded ? "" : undefined}>
      <button type="button" aria-label={`${name} messages`}>
        Messages
      </button>
      <div ref={setComposerElement}>
        <textarea ref={editor} aria-label={`${name} composer`} defaultValue={`Draft ${name}`} />
      </div>
      {props.children}
    </section>
  );
}

it.each(["Messages", "Threads sidebar", "Right panel", "Terminal toolbar"])(
  "returns an unhandled Escape from %s to the composer and keeps the draft",
  async (area) => {
    await using screen = await render(
      <EscapeChat>
        <button type="button">{area}</button>
      </EscapeChat>,
      options,
    );
    await userEvent.click(screen.getByRole("button", { name: area, exact: true }));
    await userEvent.keyboard("{Escape}!");

    await expect.element(screen.getByLabelText("Main composer")).toHaveFocus();
    await expect.element(screen.getByLabelText("Main composer")).toHaveValue("Draft Main!");
  },
);

it("keeps Escape local to the targeted side chat among multiple composers", async () => {
  const events: string[] = [];
  await using screen = await render(
    <EscapeChat events={events}>
      <EscapeChat name="Side A" embedded events={events} />
      <EscapeChat name="Side B" embedded events={events} />
    </EscapeChat>,
    options,
  );

  await userEvent.click(screen.getByLabelText("Side B messages"));
  await userEvent.keyboard("{Escape}!");
  await expect.element(screen.getByLabelText("Side B composer")).toHaveFocus();
  await expect.element(screen.getByLabelText("Side B composer")).toHaveValue("Draft Side B!");
  await expect.element(screen.getByLabelText("Main composer")).toHaveValue("Draft Main");
  await expect.element(screen.getByLabelText("Side A composer")).toHaveValue("Draft Side A");
  expect(events).toEqual(["focus:Side B"]);

  await userEvent.click(screen.getByLabelText("Main messages"));
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByLabelText("Main composer")).toHaveFocus();
  expect(events).toEqual(["focus:Side B", "focus:Main"]);
});

it("leaves locally consumed Escape to the terminal or editor", async () => {
  const consumed: string[] = [];
  const events: string[] = [];
  await using screen = await render(
    <EscapeChat events={events}>
      <textarea
        aria-label="Terminal input"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          consumed.push("terminal");
          event.preventDefault();
          event.stopPropagation();
        }}
      />
      <textarea
        aria-label="File editor"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          consumed.push("editor");
          event.preventDefault();
        }}
      />
    </EscapeChat>,
    options,
  );

  await userEvent.click(screen.getByLabelText("Terminal input"));
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByLabelText("Terminal input")).toHaveFocus();
  await userEvent.click(screen.getByLabelText("File editor"));
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByLabelText("File editor")).toHaveFocus();
  expect(consumed).toEqual(["terminal", "editor"]);
  expect(events).toEqual([]);
});

it("lets global command scopes claim Escape before returning focus", async () => {
  const events: string[] = [];
  await using screen = await render(<EscapeChat events={events} />, options);
  using _scope = {
    [Symbol.dispose]: registerCommands(
      {},
      {
        onKeyDown: (event) => {
          if (event.key !== "Escape") return false;
          events.push("scope");
        },
      },
    ),
  };
  await userEvent.click(screen.getByLabelText("Main messages"));
  await userEvent.keyboard("{Escape}");

  await expect.element(screen.getByLabelText("Main messages")).toHaveFocus();
  expect(events).toEqual(["scope"]);
});

it.each(["dialog", "menu", "listbox"])(
  "keeps Escape inside a %s even when its handler does not prevent default",
  async (role) => {
    const events: string[] = [];
    await using screen = await render(
      <EscapeChat events={events}>
        <div role={role}>
          <button type="button">Popup control</button>
        </div>
      </EscapeChat>,
      options,
    );
    await userEvent.click(screen.getByRole("button", { name: "Popup control" }));
    await userEvent.keyboard("{Escape}");

    await expect.element(screen.getByRole("button", { name: "Popup control" })).toHaveFocus();
    expect(events).toEqual([]);
  },
);

it("keeps an open modal's priority and ignores a closed popup", async () => {
  const events: string[] = [];
  await using screen = await render(
    <EscapeChat events={events}>
      <div role="dialog" aria-modal="true">
        Open modal
      </div>
    </EscapeChat>,
    options,
  );
  await userEvent.click(screen.getByLabelText("Main messages"));
  await userEvent.keyboard("{Escape}");
  expect(events).toEqual([]);

  await screen.rerender(
    <EscapeChat events={events}>
      <div data-slot="dialog-popup" hidden>
        Closed popup
      </div>
    </EscapeChat>,
  );
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByLabelText("Main composer")).toHaveFocus();
  expect(events).toEqual(["focus:Main"]);
});

it("closes thread find and focuses the composer exactly once", async () => {
  const events: string[] = [];
  await using screen = await render(<EscapeChat findActive events={events} />, options);
  await userEvent.click(screen.getByLabelText("Main messages"));
  await userEvent.keyboard("{Escape}");

  await expect.element(screen.getByLabelText("Main composer")).toHaveFocus();
  expect(events).toEqual(["find:Main", "focus:Main"]);
});

it("keeps the caret when the composer already has focus", async () => {
  const events: string[] = [];
  await using screen = await render(<EscapeChat events={events} />, options);
  const composer = screen.getByLabelText("Main composer");
  await userEvent.click(composer);
  (composer.element() as HTMLTextAreaElement).setSelectionRange(2, 2);
  await userEvent.keyboard("{Escape}");

  await expect.element(composer).toHaveFocus();
  expect((composer.element() as HTMLTextAreaElement).selectionStart).toBe(2);
  expect(events).toEqual([]);
});

it.each([
  { isComposing: true },
  { keyCode: 229 },
  { repeat: true },
  { ctrlKey: true },
  { metaKey: true },
  { altKey: true },
  { shiftKey: true },
])("leaves Escape with $0 alone", async (flags) => {
  const events: string[] = [];
  await using screen = await render(<EscapeChat events={events} />, options);
  const messages = screen.getByLabelText("Main messages");
  await userEvent.click(messages);
  messages
    .element()
    .dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...flags }),
    );

  await expect.element(messages).toHaveFocus();
  expect(events).toEqual([]);
});

it("ignores background chats and an open model picker", async () => {
  const events: string[] = [];
  await using screen = await render(<EscapeChat enabled={false} events={events} />, options);
  await userEvent.click(screen.getByLabelText("Main messages"));
  await userEvent.keyboard("{Escape}");
  await screen.rerender(<EscapeChat modelPickerOpen events={events} />);
  await userEvent.keyboard("{Escape}");

  await expect.element(screen.getByLabelText("Main messages")).toHaveFocus();
  expect(events).toEqual([]);
});
