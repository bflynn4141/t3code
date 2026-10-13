import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  type EnvironmentId,
  PEARL_API_KEY_ENV,
  PEARL_MODELS,
  type ProviderInstanceConfig,
  ProviderInstanceId,
  pearlOpenCodeConfig,
} from "@t3tools/contracts";
import { useState } from "react";

import { usePersistEnvironmentProviderInstanceMutation } from "~/hooks/useSettings";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toastManager } from "../ui/toast";
import { SettingsRow, SettingsSection } from "./settingsLayout";

// Pearl is an OpenCode instance whose only provider is Pearl's OpenAI-compatible
// API. The key is a sensitive environment variable, so the server stores it as a
// secret and clients only ever see it redacted.
export const PEARL_INSTANCE_ID = ProviderInstanceId.make("pearl");

function pearlInstance(apiKey: string): ProviderInstanceConfig {
  return {
    driver: "opencode" as ProviderInstanceConfig["driver"],
    displayName: "Pearl",
    enabled: true,
    environment: [
      { name: PEARL_API_KEY_ENV, value: apiKey, sensitive: true },
      {
        name: "OPENCODE_CONFIG_CONTENT",
        value: JSON.stringify(pearlOpenCodeConfig()),
        sensitive: false,
      },
    ],
  };
}

export function PearlConnectSection({
  environmentId,
  connected,
  readOnly,
}: {
  environmentId: EnvironmentId;
  connected: boolean;
  readOnly: boolean;
}) {
  const persist = usePersistEnvironmentProviderInstanceMutation(environmentId);
  const [apiKey, setApiKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [saving, setSaving] = useState(false);
  const editing = !connected || replacing;

  const save = async (mutation: Parameters<typeof persist>[0], success: string) => {
    setSaving(true);
    const result = await persist(mutation);
    setSaving(false);
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: "Could not update Pearl",
        description: error instanceof Error ? error.message : "The settings update failed.",
      });
      return false;
    }
    toastManager.add({ type: "success", title: success });
    return true;
  };

  const connect = async () => {
    const key = apiKey.trim();
    if (!key) return;
    const saved = await save(
      { operation: "upsert", instanceId: PEARL_INSTANCE_ID, instance: pearlInstance(key) },
      connected ? "Pearl key updated" : "Pearl connected",
    );
    if (saved) {
      setApiKey("");
      setReplacing(false);
    }
  };

  const disconnect = () =>
    save({ operation: "remove", instanceId: PEARL_INSTANCE_ID }, "Pearl disconnected");

  return (
    <SettingsSection title="Pearl">
      <SettingsRow
        title={connected ? "Earning PRL on every prompt" : "Earn PRL on every prompt"}
        description={
          connected
            ? `${PEARL_MODELS.length} Pearl models are in your model picker. Each reply shows the PRL its work mined.`
            : "Pearl's GPUs mine PRL with the same math that answers your prompts. Connect a Pearl API key to use its models here and see what each prompt earns. Access is by waitlist at platform.pearlresearch.ai."
        }
        control={
          readOnly ? null : editing ? (
            <form
              className="flex w-full items-center gap-2 sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                void connect();
              }}
            >
              <Input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-prl-infapi-…"
                aria-label="Pearl API key"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className="sm:w-56"
              />
              <Button type="submit" size="sm" disabled={saving || apiKey.trim().length === 0}>
                {connected ? "Save" : "Connect"}
              </Button>
              {replacing ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setReplacing(false)}>
                  Cancel
                </Button>
              ) : null}
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setReplacing(true)}>
                Replace key
              </Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </div>
          )
        }
      />
    </SettingsSection>
  );
}
