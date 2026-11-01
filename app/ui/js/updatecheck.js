// Telling the user a newer release exists (#435): a quiet note in the status bar
// and a "Check now" in Settings. The backend does the asking. When the release
// can be installed from here (#602), the note installs it, with a second button
// for the release page; otherwise the note opens the releases page in the browser.
import { bpmRunning } from "./bpm.js";
import { confirmDialog, el, toast } from "./dom.js";
import { invoke } from "./invoke.js";
import { t } from "./i18n.js";
import { diffByPath, edits } from "./state.js";

const SKIPPED_KEY = "tagrex.update.skipped";
const PROGRESS_EVENT = "tagrex://update-progress";
// Long enough that it never competes with opening a folder.
const START_DELAY_MS = 4000;

function skippedVersion() {
  try {
    return localStorage.getItem(SKIPPED_KEY) || "";
  } catch (e) {
    return "";
  }
}

function showPill(latest, installable) {
  const pill = el("update-pill");
  const open = el("update-open");
  open.textContent = t(installable ? "update.install" : "update.available", { version: latest });
  open.title = installable ? t("update.installTitle") : "";
  open.disabled = false;
  pill.dataset.version = latest;
  pill.classList.toggle("installable", !!installable);
  el("update-notes").hidden = !installable;
  el("update-skip").hidden = false;
  pill.hidden = false;
}

function paintProgress({ downloaded, total }) {
  const open = el("update-open");
  if (!total) open.textContent = t("update.downloading");
  else if (downloaded >= total) open.textContent = t("update.installing");
  else open.textContent = t("update.downloadingPercent", { percent: Math.floor((downloaded / total) * 100) });
}

let installing = false;

// Install: asks first, and not while anything is unapplied or a BPM run is
// writing, since the app restarts at the end. The backend downloads, checks the
// signature, installs and restarts; it only comes back here with an error.
async function installUpdate() {
  if (installing) return;
  if (diffByPath || edits.size || bpmRunning()) {
    toast(t("update.busy"), true);
    return;
  }
  const version = el("update-pill").dataset.version || "";
  const ok = await confirmDialog(t("update.confirm", { version }), t("update.installOk"), {
    detail: t("update.confirmDetail"),
  });
  if (!ok) return;
  installing = true;
  el("update-open").disabled = true;
  el("update-open").textContent = t("update.downloading");
  el("update-notes").hidden = true;
  el("update-skip").hidden = true;
  const events = window.__TAURI__ && window.__TAURI__.event;
  const unlisten = events ? await events.listen(PROGRESS_EVENT, (e) => paintProgress(e.payload)) : null;
  try {
    await invoke("install_update", {});
  } catch (e) {
    toast(String(e), true);
    showPill(version, true);
  } finally {
    installing = false;
    if (unlisten) unlisten();
  }
}

export function initUpdateCheck() {
  el("update-open").addEventListener("click", () => {
    if (el("update-pill").classList.contains("installable")) installUpdate();
    else invoke("open_releases_page", {});
  });
  el("update-notes").addEventListener("click", () => invoke("open_releases_page", {}));
  el("update-skip").addEventListener("click", () => {
    try {
      localStorage.setItem(SKIPPED_KEY, el("update-pill").dataset.version || "");
    } catch (e) {
      /* the note simply comes back next time */
    }
    el("update-pill").hidden = true;
  });
  // Quiet by design: a failed or refused check says nothing. Only the button in
  // Settings reports how it went.
  setTimeout(async () => {
    try {
      const result = await invoke("check_for_update", { automatic: true });
      if (result && result.newer && result.latest !== skippedVersion()) showPill(result.latest, result.installable);
    } catch (e) {
      /* offline, rate-limited, behind a proxy that says no */
    }
  }, START_DELAY_MS);
}

// The Settings button: asks regardless of the switch, and says what it found.
export async function checkUpdateNow() {
  const out = el("update-result");
  const say = (text) => {
    out.textContent = text;
    el("update-row").hidden = !text;
  };
  say(t("update.checking"));
  try {
    const result = await invoke("check_for_update", { automatic: false });
    if (result && result.newer) {
      say(t("update.available", { version: result.latest }));
      if (!installing) showPill(result.latest, result.installable);
    } else if (result) {
      say(t("update.upToDate", { version: result.current }));
    }
  } catch (e) {
    say(String(e));
  }
}
