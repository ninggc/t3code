import { type CustomOpenIn } from "@t3tools/contracts";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { randomUUID } from "../../lib/utils";
import { useEnvironment } from "../../state/environments";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useSettingsScope } from "./SettingsScopeContext";
import { SettingsScopeNotice } from "./SettingsScopeNotice";
import { SettingsRow, SettingsSection } from "./settingsLayout";
import { useScopedSettingsWriteAllowed } from "./useScopedSettings";

export function CustomOpenInSettings() {
  const { scope, targets, target } = useSettingsScope();
  const environment = useEnvironment(target?.environmentId ?? null);
  const canWrite = useScopedSettingsWriteAllowed();
  const updateSettings = useAtomCommand(
    serverEnvironment.updateSettings,
    "save custom open commands",
  );
  const [request, setRequest] = useState<CustomOpenIn | null>(null);
  const [saving, setSaving] = useState(false);
  if (scope.kind === "project" || scope.kind === "checkout" || targets.length !== 1 || !target) {
    return (
      <SettingsScopeNotice inline target="environment" targetId="custom-open-in">
        Choose an environment to manage its custom Open in commands.
      </SettingsScopeNotice>
    );
  }
  const editors = target.settings.customOpenIn;
  const exists = request !== null && editors.some((entry) => entry.id === request.id);
  const persist = (customOpenIn: ReadonlyArray<CustomOpenIn>) => {
    if (!canWrite || saving) return;
    setSaving(true);
    return updateSettings({
      environmentId: target.environmentId,
      input: { patch: { customOpenIn } },
    })
      .then((result) => {
        if (result._tag === "Success") setRequest(null);
      })
      .finally(() => setSaving(false));
  };
  return (
    <SettingsSection id="custom-open-in" title="Open in">
      <SettingsRow
        title="Custom open commands"
        serverScoped
        settingKeys={["customOpenIn"]}
        description={`Commands run on ${environment?.label ?? "this environment"}, including when connected remotely. Built-in editors remain available.`}
        control={
          <Button
            size="xs"
            variant="outline"
            disabled={!canWrite || saving}
            onClick={() => setRequest({ id: randomUUID(), name: "", command: "" })}
          >
            <PlusIcon className="size-3.5" />
            Add open command
          </Button>
        }
      />
      {editors.map((editor) => (
        <SettingsRow
          key={editor.id}
          title={editor.name}
          description={<code>{editor.command}</code>}
          control={
            <Button
              size="xs"
              variant="ghost"
              disabled={!canWrite || saving}
              onClick={() => setRequest(editor)}
            >
              Edit {editor.name}
            </Button>
          }
        />
      ))}
      <Dialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setRequest(null);
        }}
      >
        <DialogPopup className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{exists ? "Edit open command" : "Add open command"}</DialogTitle>
            <DialogDescription>
              Runs on {environment?.label ?? "this environment"} in the current thread's worktree,
              or the project directory. Use . or the T3CODE_CWD environment variable to pass the
              directory.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <label className="block space-y-1.5">
              <span>Name</span>
              <Input
                value={request?.name ?? ""}
                disabled={saving}
                onChange={(event) =>
                  setRequest(request && { ...request, name: event.target.value })
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span>Launch command</span>
              <Textarea
                value={request?.command ?? ""}
                disabled={saving}
                placeholder="code ."
                onChange={(event) =>
                  setRequest(request && { ...request, command: event.target.value })
                }
              />
            </label>
          </DialogPanel>
          <DialogFooter>
            {exists && request && (
              <Button
                variant="destructive-outline"
                size="sm"
                disabled={!canWrite || saving}
                onClick={() => void persist(editors.filter((entry) => entry.id !== request.id))}
              >
                Delete
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={saving} onClick={() => setRequest(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!canWrite || saving || !request?.name.trim() || !request.command.trim()}
              onClick={() => {
                if (!request) return;
                const next = {
                  ...request,
                  name: request.name.trim(),
                  command: request.command.trim(),
                };
                void persist(
                  exists
                    ? editors.map((entry) => (entry.id === next.id ? next : entry))
                    : [...editors, next],
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </SettingsSection>
  );
}
