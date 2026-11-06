import { createFileRoute } from "@tanstack/react-router";
import { ProjectActionsSettings } from "../components/settings/ProjectActionsSettings";
import { CustomOpenInSettings } from "../components/settings/CustomOpenInSettings";
import { SettingsPageContainer } from "../components/settings/settingsLayout";

function ActionsSettings() {
  return (
    <SettingsPageContainer>
      <ProjectActionsSettings />
      <CustomOpenInSettings />
    </SettingsPageContainer>
  );
}

export const Route = createFileRoute("/_chat/settings/actions")({ component: ActionsSettings });
