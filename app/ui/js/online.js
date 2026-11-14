import { prepareImportPreferences } from './import-preferences.js';
import { beginLiveImport, finishLiveImport, isLiveImportCurrent, replaceLiveImport, adoptLiveCoverPlan } from "./live-preview.js";
import { createComponentElement, upgradeComponentMarkup } from "../lib/component-elements.js";
// The ONLINE sub-tab of TAGGER (#27, #143 split it out of app.js).
//
// A metadata source: the provider search, its paging and the interruptible
// per-release prefetch, the release cards with their lazy tracklists and cover
// browser, the query presets that build a search string from the selection, and
// the import that merges a release onto the selected files. Everything it
// stages goes through the ordinary preview/apply/undo path.
import { confirmDialog, el, escapeHtml, fileName, ico, placeFloating, placeContextMenu, toast } from "./dom.js";
import { t, tn } from "./i18n.js";
import { chooseArtwork } from "./artworkpicker.js";
import { invoke } from "./invoke.js";
import { hooks } from "./hooks.js";
import { fmtTime } from "./player.js";
import { refreshFieldEditor } from "./editor.js";
import { updateSettingsDot } from "./settings.js";
import {
  edits,
  captureSelection,
  isSelectionCurrent,
  previewPlan,
  savedSettings,
  selectedPaths,
  setPreviewPlan,
  setPendingImportCover,
  setPreviewSource,
  tag,
  trackByPath,
  tracks,
} from "./state.js";

// ---- Discogs import (release picker cards, #27 step 2) ----
// Each search hit is a card; expanding it lazily fetches the release (tracklist)
// and its cover. Import and artwork actions are per-card and route
// through the same preview/apply/undo path as before.
let releaseCandidates = []; // last search results (CandidateDto[])
// Which provider produced the current results (#33). Captured at search time so
// every follow-up fetch (release, cover) hits the same source even if the user
// changes the Source dropdown afterward.
let releaseSource = "discogs";
const releaseCache = new Map(); // releaseId -> fetched ReleaseDto (with tracks)
const artworkImages = new Map(); // releaseId -> URL -> fetched image promise
const artworkRotations = new Map(); // releaseId -> committed image orientations
const artworkChoices = new Map(); // releaseId -> chosen image index
let artworkPickerOpen = false;
let artworkMenuRequest = 0;
const coverCache = new Map(); // releaseId -> CoverArtDto (full cover, for embed)
// Fetched images as data URIs, so re-rendering (layout toggle) never re-fetches.
const imageCache = new Map(); // releaseId -> { thumb?, cover? }
const expandedIds = new Set(); // cards currently expanded — survive a re-render

// Paged search (#95/#96): results come in batches of `searchPerPage`; "Load
// more" pulls the next page and appends. `searchGen` is bumped on every new
// search and on Stop, so any in-flight page fetch or background count sweep from
// an older batch bails instead of writing stale cards.
// Batch size; mirrors the #search-per-page select. A display preference,
// persisted and defaulting to 5 (#108).
const PERPAGE_STORAGE_KEY = "tagrex.searchPerPage";
function searchPerPagePref() {
  try {
    const v = parseInt(localStorage.getItem(PERPAGE_STORAGE_KEY), 10);
    return [5, 10, 15].includes(v) ? v : 5;
  } catch (e) {
    return 5;
  }
}
let searchPerPage = searchPerPagePref();
let searchPage = 0; // last page fetched (0 = none yet)
let searchHasMore = false; // provider likely has another page
let searchGen = 0; // generation token
let searchFailed = false;
let loadingResults = false; // a page fetch is in flight
let prefetching = false; // the background per-release detail sweep is running

// Whether a search is doing background work the user might want to interrupt
// (#108) — a page fetch or the per-release prefetch sweep.
function searchBusy() {
  return loadingResults || prefetching;
}

async function discogsSearch() {
  return runSearch(true);
}

async function loadMoreResults() {
  if (loadingResults || !searchHasMore) return;
  return runSearch(false);
}

// Stop the background loading (#96) without discarding what's already shown:
// bumping the generation makes in-flight workers bail; the "Load more" button
// stays available so the user can resume.
function stopLoading() {
  if (!searchBusy()) return;
  searchGen++;
  loadingResults = false;
  prefetching = false;
  updateLoadMoreUi();
  toast(t("toast.online.stopped"));
}

// The credential the given source needs (#162). Discogs takes the personal
// token from settings; Beatport takes an OAuth access token the backend keeps
// fresh behind `beatport_token`; MusicBrainz takes none. An empty string means
// "no usable credential" — the caller decides whether that is worth a message,
// and a request sent without one fails with the provider's own auth error,
// which is what the user needs to read anyway.
async function providerToken(source) {
  if (source !== "beatport") return el("discogs-token").value.trim();
  try {
    return await invoke("beatport_token", {});
  } catch (e) {
    return "";
  }
}

async function runSearch(reset) {
  const source = el("online-source").value;
  const token = await providerToken(source);
  const query = el("discogs-query").value.trim();
  // Only Discogs needs a token; MusicBrainz is unauthenticated (#33).
  if (source === "discogs" && !token) {
    toast(t("toast.online.needToken"), true);
    return;
  }
  if (source === "beatport" && !token) {
    toast(t("toast.online.needBeatport"), true);
    return;
  }
  // Remember the token locally so it's prefilled next time — the Discogs one
  // only: the Beatport token is an OAuth token the backend already stores, and
  // writing it into the Discogs token file would break the next Discogs search.
  if (source === "discogs" && token) invoke("save_discogs_token", { token }).catch(() => {});

  if (reset) {
    releaseSource = source;
    searchPerPage = Number(el("search-per-page").value) || 5;
    searchPage = 0;
    searchHasMore = false;
    releaseCandidates = [];
    releaseCache.clear();
    coverCache.clear();
    artworkChoices.clear();
    artworkRotations.clear();
    artworkImages.clear();
    imageCache.clear();
    expandedIds.clear();
    searchGen++;
  }
  const gen = searchGen;
  const page = searchPage + 1;
  loadingResults = true;
  searchFailed = false;
  updateLoadMoreUi();
  try {
    const hits = await invoke("provider_search", {
      source: releaseSource,
      token,
      query: { album: query, format: el("search-format").value || null, page, per_page: searchPerPage },
    });
    if (gen !== searchGen) return; // a newer search / Stop superseded this
    searchPage = page;
    // A full page back suggests there's more to fetch.
    searchHasMore = hits.length >= searchPerPage;
    // Append, skipping ids already shown in case pages overlap.
    const seen = new Set(releaseCandidates.map((c) => c.id));
    const added = hits.filter((c) => !seen.has(c.id));
    releaseCandidates.push(...added);
    renderReleaseList();
    prefetchReleaseCounts(added, gen); // count only the newly added page
  } catch (e) {
    if (gen !== searchGen) return;
    searchFailed = true;
    toast(String(e), true);
  } finally {
    if (gen === searchGen) {
      loadingResults = false;
      updateLoadMoreUi();
    }
  }
}

// Show/hide the Load more / Stop footer to match the current loading state.
function updateLoadMoreUi() {
  const busy = searchBusy();
  const empty = el("discogs-empty");
  const heading = el("online-empty-heading");
  const state = loadingResults ? "searching" : searchFailed ? "searchError" : searchPage ? "searchNone" : "searchEmpty";
  empty.hidden = releaseCandidates.length > 0;
  const messageKey = state === "searchEmpty" ? "online.empty" : `inspector.${state}`;
  empty.dataset.i18n = messageKey;
  empty.textContent = t(messageKey);
  heading.dataset.i18n = `inspector.${state}Heading`;
  heading.textContent = t(heading.dataset.i18n);
  // The search button is one toggling slot (#111): magnifier ⇄ Stop square.
  const btn = el("discogs-search");
  btn.classList.toggle("busy", busy);
  btn.title = busy ? t("online.stopLoading") : t("online.search");
  btn.setAttribute("aria-label", btn.title);
  const wrap = el("release-more");
  if (!wrap) return;
  wrap.hidden = releaseCandidates.length === 0;
  el("load-more").hidden = busy || !searchHasMore;
}

async function loadSavedToken() {
  try {
    const token = await invoke("saved_discogs_token", {});
    if (token) el("discogs-token").value = token;
  } catch (e) {
    /* no saved token yet */
  }
  updateSettingsDot();
}


// Meta line "Country · Year · Format" from whatever fields the candidate carries.
function candidateMeta(c) {
  return [c.country, c.year, c.format].filter(Boolean).join(" · ");
}

function releaseList() {
  return el("release-list");
}

function cardEl(id) {
  return releaseList().querySelector(`.release-card[data-id="${cssEscape(id)}"]`);
}

function coverElOf(id) {
  return releaseList().querySelector(`[data-id="${cssEscape(id)}"] .release-cover`);
}

// The track/disc-count pill, whichever layout this release is shown in.
function countPillOf(id) {
  return releaseList().querySelector(`[data-id="${cssEscape(id)}"] .tk-count`);
}

// "N tracks", or "N tracks · M discs" once the release is fetched; a dash before.
function countLabel(id) {
  const release = releaseCache.get(id);
  if (!release) return t("online.tracksUnknown");
  const discs = discCount(release);
  const tracks = tn("unit.track", release.tracks.length);
  // Name the unit by medium (#341): a cassette set is "N cassettes", not discs.
  // Only physical media reach `discs > 1` (digital is guarded out in discCount),
  // and a vinyl record is a disc, so everything else stays `unit.disc`.
  const unit = mediaKind(release.format) === "cassette" ? "unit.cassette" : "unit.disc";
  return discs > 1 ? `${tracks} · ${tn(unit, discs)}` : tracks;
}

// Highest disc number across track positions ("2-1" -> disc 2); 1 if unmarked.
function discCount(release) {
  // `disc_total` is a real disc/record count only for physical media (CD, Vinyl,
  // Cassette): a multi-record vinyl set (a 2×LP) numbers its tracks by side
  // letter (A1, B2, C1, D3), so the record count can only come from there. For a
  // DIGITAL release Discogs states the FILE count in `disc_total` instead — a
  // 4-track "File, FLAC, EP" is 4, a hard-drive compilation thousands — so honour
  // it as discs only when the medium is physical (#337). The position-derived
  // count still covers a multi-disc CD numbered "1-…"/"2-…".
  let max = isPhysicalMedia(release.format) && release.disc_total > 1 ? release.disc_total : 1;
  for (const t of release.tracks) {
    const m = /^(\d+)-/.exec(t.position || "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

// ---- media-type badge on the cover (#98, per the Design spec) ----
// Infer the medium from the provider's free `format` text; first hit wins in
// this order (vinyl → cd → digital → generic). Case-insensitive substring.
function mediaKind(format) {
  const f = (format || "").toLowerCase();
  const has = (...ks) => ks.some((k) => f.includes(k));
  if (has("cassette", "tape")) return "cassette";
  if (has("vinyl", "lp", "ep", '7"', '10"', '12"', "shellac")) return "vinyl";
  if (has("sacd", "hdcd", "cdr", "compact disc", "cd")) return "cd";
  if (has("file", "flac", "mp3", "wav", "aac", "digital", "download", "streaming")) return "digital";
  return "generic";
}

// What is WRITTEN to the MEDIA tag (see mediaTagValue): data, so it stays as it is
// in every language. What the badge's tooltip says is `mediaTitle`.
const MEDIA_LABEL = { vinyl: "Vinyl", cd: "CD", cassette: "Cassette", digital: "Digital", generic: "" };

function mediaTitle(kind) {
  return kind === "cd" ? "CD" : t(`media.${kind}`);
}

// Whether the medium is a physical disc/record set, so a Discogs format quantity
// is a disc count rather than a file count (#337, #339): true for vinyl / CD /
// cassette, false for a digital "File" release (where the quantity is files).
function isPhysicalMedia(format) {
  const kind = mediaKind(format);
  return kind === "vinyl" || kind === "cd" || kind === "cassette";
}

// The value written to the MEDIA tag on import (#106): a clean normalized label,
// or the raw provider format string when the kind is unrecognised (so nothing is
// lost). Drives the vinyl side notation (%side% / Position column).
function mediaTagValue(format) {
  const label = MEDIA_LABEL[mediaKind(format)];
  return label || (format || "").trim() || null;
}

// Artwork count appears on the cover once the release images are known.
function mediaBadgeMarkup(c) {
  const kind = mediaKind(c.format);
  const release = releaseCache.get(c.id);
  const images = release ? (release.images?.length || (release.cover_image_url ? 1 : 0)) : 0;
  const n = images ? `<span class="n">${images}</span>` : "";
  const label = [MEDIA_LABEL[kind] && mediaTitle(kind), images && tn("unit.image", images)].filter(Boolean).join(" · ");
  return `<span class="media-badge"${label ? ` title="${escapeHtml(label)}"` : ""}>${ico("image")}${n}</span>`;
}

// Refresh artwork count after fetching release details.
function updateMediaBadge(c) {
  const badge = coverElOf(c.id)?.querySelector(".media-badge");
  if (badge) badge.outerHTML = mediaBadgeMarkup(c);
  const card = cardEl(c.id);
  if (card) {
    const candidate = releaseCandidates.find(candidate => candidate.id === c.id) || c;
    const meta = card.querySelector('.release-meta');
    if (meta) meta.textContent = releaseMeta(candidate);
    const label = card.querySelector('.release-label');
    const markup = releaseLabel(candidate);
    if (label && label.dataset.markup !== markup) {
      label.innerHTML = markup; label.dataset.markup = markup;
      upgradeComponentMarkup(label);
    }
  }
}

function renderReleaseList() {
  const list = releaseList();
  list.innerHTML = "";
  el("release-toolbar").hidden = releaseCandidates.length === 0;
  // The whole phrase, not just the number: "Found 1 entries" was the same
  // disagreement as the card counts (#167).
  el("release-found").textContent = t("online.found", {
    entries: tn("unit.entry", releaseCandidates.length),
  });
  el("discogs-empty").hidden = releaseCandidates.length > 0;
  if (releaseCandidates.length === 0) {
    // Named, so the static repaint of a language switch finds the right text.
    el("discogs-empty").dataset.i18n = "online.noReleases";
    el("discogs-empty").textContent = t("online.noReleases");
    return;
  }
  for (const c of releaseCandidates) {
    list.insertAdjacentHTML("beforeend", cardMarkup(c));
  }
  // Keep the artwork tile's dedicated native hit surface; normal actions are
  // mounted components before any controller reads or binds their nodes.
  upgradeComponentMarkup(list, { exclude: '.release-cover' });
  // Restore images (from cache) and any expanded tracklists after the re-render.
  for (const c of releaseCandidates) {
    applyImage(c);
    const card = cardEl(c.id);
    if (card && expandedIds.has(c.id) && releaseCache.has(c.id)) {
      card.setAttribute("aria-expanded", "true");
      card.querySelector(".release-caret").innerHTML = ico("caret-down");
      renderTracklist(card, releaseCache.get(c.id));
      card.querySelector(".release-tracklist").dataset.loaded = "1";
    }
  }
  updateLoadMoreUi();
}

// ---- query presets (#97) ----
// Fill the search box from the current selection instead of only manual typing.
function baseNameNoExt(path) {
  const base = fileName(path);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

function folderNameOf(path) {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const dir = i >= 0 ? path.slice(0, i) : "";
  const j = Math.max(dir.lastIndexOf("/"), dir.lastIndexOf("\\"));
  return j >= 0 ? dir.slice(j + 1) : dir;
}

// The track a preset draws from: the first selected row, else the first loaded.
function presetSourceTrack() {
  const byPath = trackByPath();
  const first = selectedPaths()[0];
  return (first && byPath.get(first)) || tracks[0] || null;
}

// A name off the disk, made searchable (#158). Downloaded music is routinely
// filed with underscores for spaces, and a provider asked for
// `various_-_la_bush_-_music_from_the_temple_of_house` matches nothing — which
// reads as "this release isn't in the database" rather than "that isn't a query".
//
// Underscores only. A dot carries meaning in real titles (`Ltd.`, `Vol. 2`,
// `M.I.A.`), so rewriting those would break as many queries as it fixed;
// an underscore in a release title is essentially unheard of.
function searchableName(name) {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function queryFromPreset(kind) {
  const t = presetSourceTrack();
  if (!t) return "";
  switch (kind) {
    // The two path-derived presets normalise; the tag-derived ones below don't —
    // an underscore in a tag was put there on purpose, and cleaning tag values
    // up is what GENERATOR is for.
    case "folder":
      return searchableName(folderNameOf(t.path));
    case "filename":
      return searchableName(baseNameNoExt(t.path));
    case "album":
      return (t.tags.album || "").trim();
    case "artist-title":
      return [t.tags.artist, t.tags.title].filter(Boolean).join(" ").trim();
    default:
      return "";
  }
}

// The queries the current selection can build (#193). They hang off a caret on
// the field rather than off a dropdown beside it: a source is not a mode the box
// is in, it is one more query on offer — so each row shows the TEXT it would
// search for, with where it came from as a hint, and "manual" stops being a
// thing to choose (an empty field is already that).
const QUERY_SOURCES = [
  { kind: "folder", label: "online.srcFolder" },
  { kind: "filename", label: "online.srcFile" },
  { kind: "album", label: "field.album" },
  { kind: "artist-title", label: "online.srcArtistTitle" },
];

function closeQueryPresets() {
  el("query-preset-menu").hidden = true;
  // The caret shows its menu is open, the field tools' "on" state (#547).
  el("query-presets").setAttribute("aria-expanded", "false");
}

// What the menu offers: every source with something to say, and one row per
// distinct query — two sources that produce the same text (a folder named after
// the album) are one offer wearing both labels, not two identical rows.
function queryOffers() {
  const byText = new Map();
  for (const source of QUERY_SOURCES) {
    const text = queryFromPreset(source.kind);
    if (!text) continue;
    const seen = byText.get(text);
    if (seen) seen.labels.push(t(source.label));
    else byText.set(text, { text, labels: [t(source.label)] });
  }
  return [...byText.values()];
}

function toggleQueryPresets() {
  const menu = el("query-preset-menu");
  if (!menu.hidden) {
    closeQueryPresets();
    return;
  }
  menu.innerHTML = "";
  const offers = queryOffers();
  if (offers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "col-menu-row muted query-empty";
    empty.textContent = t("online.pickTrackForQuery");
    menu.appendChild(empty);
  }
  for (const offer of offers) {
    const row = createComponentElement("button");
    row.type = "button";
    row.className = "col-menu-row tk-menu-item query-row";
    row.innerHTML =
      `<span class="query-text">${escapeHtml(offer.text)}</span>` +
      `<span class="query-source">${escapeHtml(offer.labels.join(" · "))}</span>`;
    row.title = offer.text;
    row.addEventListener("click", () => {
      closeQueryPresets();
      el("discogs-query").value = offer.text;
      discogsSearch();
    });
    menu.appendChild(row);
  }
  menu.hidden = false;
  el("query-presets").setAttribute("aria-expanded", "true");
  // `floating` neutralizes .col-menu's own absolute placement so the inline
  // offsets from placeFloating are the ones that count (#160).
  menu.classList.add("floating");
  placeQueryPresets();
}

// As wide as the query box it drops from (#408), the way the recent-folders
// list follows the path box (#407), not as wide as its longest suggestion.
function placeQueryPresets() {
  const box = el("query-box");
  placeFloating(el("query-preset-menu"), box, {
    align: "left",
    width: box.getBoundingClientRect().width,
  });
}
window.addEventListener("resize", () => {
  if (!el("query-preset-menu").hidden) placeQueryPresets();
});

function releaseMeta(c) {
  const release = releaseCache.get(c.id);
  const format = release?.format || c.format || '';
  const medium = MEDIA_LABEL[mediaKind(format)] || String(format).split(',')[0].trim();
  const quantity = release && isPhysicalMedia(format) ? discCount({ ...release, format }) : 1;
  return [release?.year || c.year, release?.country || c.country, quantity > 1 ? `${quantity}×${medium}` : medium].filter(Boolean).join(' · ');
}

function releaseLabel(c) {
  const labels = releaseCache.get(c.id)?.labels || [];
  if (labels.length > 1) return `<select class="label-picker" aria-label="${escapeHtml(t('online.labelPickerTitle'))}" title="${escapeHtml(t('online.labelPickerTitle'))}">${labels.map((label,index)=>
    `<option value="${index}">${escapeHtml([label.name,label.catalog_number].filter(Boolean).join(' · '))}</option>`).join('')}</select>`;
  const name = labels[0]?.name || '';
  const catalogue = String(labels[0]?.catalog_number || c.catalog_number || '').trim();
  const number = catalogue.toLowerCase() === 'none' ? '' : catalogue;
  if (!name && !number) return '';
  return `<button type="button" class="release-label-link" title="${escapeHtml(t('online.openRelease'))}">${name ? `<span>${escapeHtml(name)}</span>` : ''}${name && number ? '<span aria-hidden="true"> · </span>' : ''}${number ? `<span class="rb-catno">${escapeHtml(number)}</span>` : ''}</button>`;
}

// Open a candidate's provider release page (#92). Source is the committed search
// source (all shown candidates share it); the backend builds + validates the URL.
async function openReleasePage(id) {
  try {
    await invoke("open_release_page", { source: releaseSource, id });
  } catch (e) {
    toast(String(e), true);
  }
}

function cardMarkup(c) {
  // Title leads, followed by artist and quiet factual metadata. Keep the full
  // provider format/edition wording available without filling the result row.
  const artist = c.artist ? `<span class="release-artist" title="${escapeHtml(c.artist)}">${escapeHtml(c.artist)}</span>` : "";
  const fullMeta = candidateMeta(c);
  const meta = releaseMeta(c);
  const metaLine = meta ? `<span class="release-meta" title="${escapeHtml(fullMeta)}">${escapeHtml(meta)}</span>` : "";
  const label = releaseLabel(c);
  return `
    <article class="release-card" data-id="${escapeHtml(c.id)}" aria-expanded="false">
      <div class="release-header-row">
        <button class="release-cover" type="button" data-act="artwork" title="${escapeHtml(t("artwork.title"))}" aria-label="${escapeHtml(t("artwork.forRelease", { title: c.title }))}">${mediaBadgeMarkup(c)}</button>
        <button class="release-head" type="button">
          <span class="release-info">
            <span class="release-title" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span>
            ${artist}
            ${metaLine}
          </span>
          <span class="release-caret" aria-hidden="true">${ico("chevron-right")}</span>
        </button>
        <div class="release-label" data-markup="${escapeHtml(label)}">${label}</div>
        <button class="release-import btn-sm" type="button" data-act="import" title="${escapeHtml(t("online.importTitle"))}" aria-label="${escapeHtml(t("online.importTitle"))}"><svg class="ico"><use href="#i-import"/></svg><span>${t("online.importAction")}</span></button>
      </div>
      <div class="release-tracklist"></div>
    </article>`;
}

// Put an image into a card's cover well without wiping the media badge (#98)
// that shares it, and say whether it is round label art (#397).
function setCoverImage(cover, src) {
  cover.querySelector("img")?.remove();
  // Built through the DOM: the data URI carries a server's MIME type (#603).
  const img = document.createElement("img");
  img.alt = "";
  img.src = src;
  cover.prepend(img);
  markRoundArt(cover, src);
}

// Round label art (#397): a record label drawn as a circle on a white square —
// a whole label's catalogue is often sleeved that way. In the framed square
// well the white corners read as a box the circle was forced into, so the well
// drops its frame and clips the image to the circle (style.css): the white is
// cut away rather than blended, which WKWebView won't do inside the card's
// button, and a clip works the same in both themes.
//
// Told apart from an ordinary cover by sampling a small copy of the image: all
// four corners near-white, and the middle of all four edges NOT — the circle
// reaches (almost) to the edges, a square cover on a white background doesn't.
// How far in it starts is measured too, so the clip lands on the circle's own
// edge and leaves no white rim. The image is a data URI fetched by the backend,
// so reading its pixels is never cross-origin.
const roundArtCache = new Map(); // src -> inset fraction, or null when not round

function markRoundArt(cover, src) {
  const apply = (inset) => {
    cover.classList.toggle("round-art", inset != null);
    if (inset != null) cover.style.setProperty("--art-inset", `${(inset * 100).toFixed(2)}%`);
    else cover.style.removeProperty("--art-inset");
  };
  if (roundArtCache.has(src)) {
    apply(roundArtCache.get(src));
    return;
  }
  apply(null);
  const img = new Image();
  img.onload = () => {
    const inset = roundArtInset(img);
    roundArtCache.set(src, inset);
    // The well may hold a newer image by now (the full cover replacing the
    // thumbnail); only the one that was measured gets the verdict.
    if (cover.querySelector("img")?.getAttribute("src") === src) apply(inset);
  };
  img.src = src;
}

// How far in from the image's edge its circle starts, as a fraction of the
// width — or null when the image is not a circle on white.
function roundArtInset(img) {
  const n = 100;
  if (!img.naturalWidth || Math.abs(img.naturalWidth - img.naturalHeight) > 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, n, n);
  const { data } = ctx.getImageData(0, 0, n, n);
  const white = (x, y) => {
    const i = (y * n + x) * 4;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    return Math.min(r, g, b) >= 232 && Math.max(r, g, b) - Math.min(r, g, b) <= 12;
  };
  const last = n - 1;
  const mid = n >> 1;
  const corners = [
    [0, 0], [3, 3], [last, 0], [last - 3, 3],
    [0, last], [3, last - 3], [last, last], [last - 3, last - 3],
  ];
  if (!corners.every(([x, y]) => white(x, y))) return null;
  // Walk in from the middle of each edge to the first non-white pixel. A
  // circle is there within a few percent on all four sides; anything further
  // in is a square cover with a white border, not a label.
  const steps = [
    (k) => white(k, mid), (k) => white(last - k, mid),
    (k) => white(mid, k), (k) => white(mid, last - k),
  ];
  const maxInset = 8;
  let inset = maxInset;
  for (const isWhite of steps) {
    let k = 0;
    while (k <= maxInset && isWhite(k)) k += 1;
    if (k > maxInset) return null;
    inset = Math.min(inset, k);
  }
  return inset / n;
}

// Sources whose search hits cannot say whether a release has cover art (#748).
// Their thumbnail URL is only where the art would be, so a card loads it once
// the release lookup (the count sweep runs one per card) confirms a front cover;
// a release without art then costs no request that could only answer 404.
const THUMB_AFTER_LOOKUP = new Set(["musicbrainz"]);

// Show the release's cover thumbnail, fetching + caching it once. Cached data
// URIs are reused, so a re-render never re-hits Discogs.
async function applyImage(c) {
  const selectedCover = coverCache.get(c.id);
  if (selectedCover) {
    const cover = coverElOf(c.id);
    if (cover) setCoverImage(cover, `data:${selectedCover.mime};base64,${selectedCover.data_base64}`);
    return;
  }
  const gen = searchGen;
  const source = releaseSource;
  const kind = "thumb";
  const url = c.thumb_url || c.cover_url;
  if (!url) return;
  const cached = imageCache.get(c.id) || {};
  let dataUri = cached[kind];
  if (!dataUri && THUMB_AFTER_LOOKUP.has(source)) {
    const release = releaseCache.get(c.id);
    if (!release || !release.cover_image_url) return;
  }
  if (!dataUri) {
    const token = await providerToken(source);
    if (gen !== searchGen) return;
    try {
      const img = await invoke("provider_fetch_image", { source, token, url });
      if (gen !== searchGen) return;
      dataUri = `data:${img.mime};base64,${img.data_base64}`;
      cached[kind] = dataUri;
      imageCache.set(c.id, cached);
    } catch (e) {
      return; // leave the striped placeholder
    }
    // A thumbnail that arrives after the card was expanded must not cover up
    // the full-size image that came in first (#748 loads thumbnails later).
    if (coverCache.has(c.id)) return;
  }
  if (gen !== searchGen) return;
  const chosen = coverCache.get(c.id);
  const cover = coverElOf(c.id);
  if (cover) setCoverImage(cover, chosen ? `data:${chosen.mime};base64,${chosen.data_base64}` : dataUri);
}

// Fetch each release once, in the background, to fill the track/disc count on
// every card up front. A small pool fetches several at a time (the commands are
// async/off-main-thread) so counts appear quickly without bursting past Discogs'
// 60/min limit. Cached, so expanding a card and toggling layout are then instant.
const PREFETCH_CONCURRENCY = 4;

// A rate limit (HTTP 429) pauses every worker of the sweep for as long as the
// provider asks, then the release it hit is tried again. The backend only reports
// the limit, it does not wait; the sweep used to skip to the next release at once,
// so the rest of the page went out straight into the limit and kept it in force.
// At least a second, so a stated wait of 0 is not a burst, and at most two
// minutes, so a page left open does not sit dark for an hour.
const PREFETCH_MIN_PAUSE_MS = 1000;
const PREFETCH_MAX_PAUSE_MS = 120_000;
// A server that is down answers everything this way too (MusicBrainz and Soundeo
// report a 503 as a rate limit). This many limits with nothing fetched between
// them ends the sweep, three rounds of all the workers, and the cards keep their
// dash; expanding a card still fetches it.
const PREFETCH_MAX_LIMITS_IN_A_ROW = 12;

// The wait a rate-limit error asks for, in ms, or null for any other error.
function rateLimitPauseMs(e) {
  const failure = e && e.failure && e.failure.message;
  if (!failure || failure.code !== "error.provider.rateLimited") return null;
  const seconds = Number(failure.args && failure.args.seconds);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : PREFETCH_MAX_PAUSE_MS;
  return Math.min(Math.max(ms, PREFETCH_MIN_PAUSE_MS), PREFETCH_MAX_PAUSE_MS);
}

async function prefetchReleaseCounts(items, gen) {
  const source = releaseSource;
  const token = await providerToken(source);
  if (gen !== undefined && gen !== searchGen) return;
  const queue = (items || releaseCandidates).filter((c) => !releaseCache.has(c.id));
  if (queue.length === 0) return;
  // The sweep is interruptible background work — show Stop while it runs (#108).
  prefetching = true;
  updateLoadMoreUi();
  // When the sweep may send its next request: later than now while a rate limit holds.
  let resumeAt = 0;
  let limitsInARow = 0;
  async function worker() {
    while (queue.length) {
      // A newer search, or Stop (#96), bumps the generation → bail.
      if (gen !== undefined && gen !== searchGen) return;
      // Wait out a rate limit, then look at the generation again.
      const wait = resumeAt - Date.now();
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }
      const c = queue.shift();
      if (!c || releaseCache.has(c.id)) continue;
      try {
        const release = await invoke("provider_fetch_release", { source, token, releaseId: c.id });
        if (gen !== undefined && gen !== searchGen) return;
        releaseCache.set(c.id, release);
        const pill = countPillOf(c.id);
        if (pill) pill.textContent = countLabel(c.id);
        updateMediaBadge(c); // fill the badge's ×N now that disc count is known
        applyImage(c); // a thumbnail that waited for this lookup (#748)
        limitsInARow = 0;
      } catch (e) {
        // A rate limit pauses the sweep and retries this release after it.
        const pause = rateLimitPauseMs(e);
        if (pause !== null) {
          limitsInARow += 1;
          if (limitsInARow >= PREFETCH_MAX_LIMITS_IN_A_ROW) {
            queue.length = 0;
            return;
          }
          queue.unshift(c);
          resumeAt = Math.max(resumeAt, Date.now() + pause);
        }
        /* anything else: skip this one; the card just keeps its dash */
      }
    }
  }
  await Promise.all(Array.from({ length: PREFETCH_CONCURRENCY }, worker));
  // Only the sweep for the current generation owns the flag (Stop / a newer
  // search may have moved on already).
  if (gen === undefined || gen === searchGen) {
    prefetching = false;
    updateLoadMoreUi();
  }
}

// CSS.escape isn't guaranteed in every webview; ids are numeric strings anyway.
function cssEscape(s) {
  return String(s).replace(/["\\]/g, "\\$&");
}

// Expand/collapse a card; on first expand, fetch the release + render its
// tracklist and pull the full cover for embedding.
async function toggleCard(card) {
  const id = card.dataset.id;
  const expanded = card.getAttribute("aria-expanded") === "true";
  card.setAttribute("aria-expanded", expanded ? "false" : "true");
  card.querySelector(".release-caret").innerHTML = ico(expanded ? "chevron-right" : "caret-down");
  if (expanded) {
    expandedIds.delete(id);
    return;
  }
  expandedIds.add(id);
  const body = card.querySelector(".release-tracklist");
  if (body.dataset.loaded === "1") {
    // Drawn for wherever the list stood when it was last open. A card closed
    // while its release was loading had no rows to measure its width from.
    renderWindow(card, true);
    fixTrackColumnWidth(card);
    return;
  }
  // Skeleton while the release fetch is in flight (inert stripe motif).
  body.innerHTML = `<div style="padding: 8px 10px">
      <div class="skeleton-line w-80"></div>
      <div class="skeleton-line w-60"></div>
      <div class="skeleton-line w-40"></div>
    </div>`;
  const token = await providerToken(releaseSource);
  try {
    let release = releaseCache.get(id);
    if (!release) {
      release = await invoke("provider_fetch_release", { source: releaseSource, token, releaseId: id });
      releaseCache.set(id, release);
    }
    updateMediaBadge(releaseCandidates.find(c => c.id === id) || { id, format: release.format });
    renderTracklist(card, release);
    body.dataset.loaded = "1";
    const tkPill = countPillOf(id); if (tkPill) tkPill.textContent = countLabel(id);
    loadFullCover(id, release.cover_image_url, card);
  } catch (e) {
    body.innerHTML = "";
    body.dataset.loaded = "";
    expandedIds.delete(id);
    toast(String(e), true);
  }
}

// Selection changes do not alter release order or track checkboxes.
function refreshReleaseMatches() {}

// ---- the drawn window of a tracklist ----
// A release can list thousands of tracks (USB "editions" of 1,017 and 3,353),
// and every row carries two sticky cells, the number and the duration. Drawn
// whole, that was about 7,000 composited layers and 34,000 nodes, and the list
// scrolled at 15 fps. Only the rows in and near view are in the DOM; a spacer
// row of the exact height stands for the rows above and another for those
// below. The ticks live in the state below, not in the
// rows, so they hold for the rows not drawn.
const tracklistState = new WeakMap(); // card element -> { release, rows, checked, ... }
const WINDOW_MARGIN_PX = 1000; // drawn beyond each edge of the view
const WINDOW_CHUNK = 32; // the window moves this many rows at a time

function trackRowHtml(state, i) {
  const { release } = state;
  const t = release.tracks[i];
  // Show the per-track artist only when it differs from the album artist —
  // otherwise it's noise on every row; it truncates before the title.
  const differs = t.artist && t.artist !== release.artist;
  const artistEl = differs ? `<span class="tk-a">${escapeHtml(t.artist)}</span>` : "";
  return `<tr class="tk-row">
    <td class="tk-lead"><span class="tk-lead-inner"><input type="checkbox"${state.checked[i] ? " checked" : ""} data-i="${i}" /><span class="tk-num">${escapeHtml(t.position)}</span></span></td>
    <td class="tk-track"><span class="tk-track-inner"><span class="tk-t" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>${artistEl}</span></td>
    <td class="tk-dur">${t.duration_secs ? fmtTime(t.duration_secs) : "—"}</td>
  </tr>`;
}

function sectionRowHtml(section) {
  return `<tr class="tk-section"><td colspan="3"><span class="tk-section-label" title="${escapeHtml(section)}">${escapeHtml(section)}</span></td></tr>`;
}

function spacerRowHtml(px) {
  return `<tr class="tk-spacer" aria-hidden="true"><td colspan="3" style="height: ${px}px"></td></tr>`;
}

// The index of the drawn row that covers `y` px below the top of the rows.
function rowAt(offsets, y) {
  let lo = 0;
  let hi = offsets.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Measure a drawn row of each kind and lay out where every row starts. A row
// after the first has a 1 px rule above it, so the first row is measured apart.
function measureRows(tbody, state) {
  const drawn = [...tbody.children].filter((tr) => !tr.classList.contains("tk-spacer"));
  const heights = { track: 0, section: 0, firstTrack: 0, firstSection: 0 };
  drawn.forEach((tr, k) => {
    const h = tr.getBoundingClientRect().height;
    const kind = tr.classList.contains("tk-section") ? "section" : "track";
    const index = state.start + k;
    if (index === 0) heights[kind === "track" ? "firstTrack" : "firstSection"] = h;
    else if (!heights[kind]) heights[kind] = h;
  });
  if (!heights.track && !heights.section) return;
  heights.track ||= heights.firstTrack || 22;
  heights.section ||= heights.firstSection || heights.track;
  heights.firstTrack ||= heights.track;
  heights.firstSection ||= heights.section;
  const offsets = new Float64Array(state.rows.length + 1);
  state.rows.forEach((row, k) => {
    const h = row.section !== undefined
      ? (k === 0 ? heights.firstSection : heights.section)
      : (k === 0 ? heights.firstTrack : heights.track);
    offsets[k + 1] = offsets[k] + h;
  });
  state.heights = heights;
  state.offsets = offsets;
}

// Draw the rows of `card`'s tracklist that are in and near view. Unless forced,
// nothing is drawn while the window has not moved by a chunk.
function renderWindow(card, force = false, remeasured = false) {
  const state = tracklistState.get(card);
  const tbody = card.querySelector(".release-tracklist tbody");
  if (!state || !tbody || card.getAttribute("aria-expanded") !== "true") return;
  const n = state.rows.length;
  let start = 0;
  let end = Math.min(n, WINDOW_CHUNK * 2);
  const scroller = card.closest(".online-scroll");
  // A hidden panel has no size to go by, and a selection change can redraw the
  // list while another tab is open: the rows stay where the panel will show them.
  const hidden = !scroller || scroller.clientHeight === 0;
  if (hidden && state.end > 0) {
    start = state.start;
    end = state.end;
  } else if (state.offsets && !hidden) {
    const view = scroller.getBoundingClientRect();
    const top = tbody.getBoundingClientRect().top;
    const from = rowAt(state.offsets, view.top - top - WINDOW_MARGIN_PX);
    const to = rowAt(state.offsets, view.bottom - top + WINDOW_MARGIN_PX);
    start = Math.floor(from / WINDOW_CHUNK) * WINDOW_CHUNK;
    end = Math.min(n, (Math.floor(to / WINDOW_CHUNK) + 1) * WINDOW_CHUNK);
  }
  if (!force && state.offsets && start === state.start && end === state.end) return;
  // Scrolling moves the window a chunk or two at a time: the rows still in it
  // stay, only the ones leaving and arriving change, and nothing is measured.
  // Rebuilding the whole window each time cost a dropped frame on a fast scroll.
  const overlaps = !force && state.offsets && start < state.end && end > state.start;
  if (overlaps) {
    shiftWindow(tbody, state, start, end);
    return;
  }
  state.start = start;
  state.end = end;
  let html = "";
  if (state.offsets && start > 0) html += spacerRowHtml(state.offsets[start]);
  html += rowsHtml(state, start, end);
  if (state.offsets && end < n) html += spacerRowHtml(state.offsets[n] - state.offsets[end]);
  tbody.innerHTML = html;
  if (hidden) return;
  // Lay the rows out from what was drawn: the first time, and again whenever
  // the drawn total strays from the layout, so the spacers never drift from the
  // rows they stand for.
  if (tracklistDrift(card) > 2) {
    const before = state.offsets;
    measureRows(tbody, state);
    const moved = state.offsets && (!before || Math.abs(before[n] - state.offsets[n]) > 2);
    if (moved && !remeasured) renderWindow(card, true, true);
  }
}

// How far the drawn table is from the height its layout says it should be.
function tracklistDrift(card) {
  const state = tracklistState.get(card);
  const tbody = card.querySelector(".release-tracklist tbody");
  if (!state?.offsets || !tbody) return Infinity;
  return Math.abs(tbody.getBoundingClientRect().height - state.offsets[state.rows.length]);
}

function rowsHtml(state, from, to) {
  let html = "";
  for (let k = from; k < to; k++) {
    const row = state.rows[k];
    html += row.section !== undefined ? sectionRowHtml(row.section) : trackRowHtml(state, row.i);
  }
  return html;
}

// Move the drawn window from [state.start, state.end) to [start, end), which
// overlap: take the rows that left off each end, add the ones that arrived, and
// give the two spacers their new heights.
function shiftWindow(tbody, state, start, end) {
  const n = state.rows.length;
  const spacer = (px) => {
    const tr = document.createElement("tr");
    tr.className = "tk-spacer";
    tr.setAttribute("aria-hidden", "true");
    tr.innerHTML = `<td colspan="3" style="height: ${px}px"></td>`;
    return tr;
  };
  let top = tbody.firstElementChild?.classList.contains("tk-spacer") ? tbody.firstElementChild : null;
  let bottom = tbody.lastElementChild?.classList.contains("tk-spacer") && tbody.lastElementChild !== top
    ? tbody.lastElementChild
    : null;
  // Rows that left the top, then the bottom.
  for (let k = state.start; k < Math.min(start, state.end); k++) (top ? top.nextElementSibling : tbody.firstElementChild).remove();
  for (let k = Math.max(end, state.start); k < state.end; k++) (bottom ? bottom.previousElementSibling : tbody.lastElementChild).remove();
  // Rows that arrived at the top, then the bottom.
  if (start < state.start) {
    const html = rowsHtml(state, start, state.start);
    if (top) top.insertAdjacentHTML("afterend", html);
    else tbody.insertAdjacentHTML("afterbegin", html);
  }
  if (end > state.end) {
    const html = rowsHtml(state, state.end, end);
    if (bottom) bottom.insertAdjacentHTML("beforebegin", html);
    else tbody.insertAdjacentHTML("beforeend", html);
  }
  // The spacers: present only when rows stand above or below the window.
  if (start > 0) {
    if (!top) {
      top = spacer(0);
      tbody.prepend(top);
    }
    top.firstElementChild.style.height = `${state.offsets[start]}px`;
  } else if (top) top.remove();
  if (end < n) {
    if (!bottom) {
      bottom = spacer(0);
      tbody.append(bottom);
    }
    bottom.firstElementChild.style.height = `${state.offsets[n] - state.offsets[end]}px`;
  } else if (bottom) bottom.remove();
  state.start = start;
  state.end = end;
}

// Every open tracklist follows the panel as it scrolls, once a frame.
let windowFrame = 0;
function scheduleTracklistWindows() {
  if (windowFrame) return;
  windowFrame = requestAnimationFrame(() => {
    windowFrame = 0;
    for (const id of expandedIds) {
      const card = cardEl(id);
      if (card) renderWindow(card);
    }
  });
}
const onlineScroll = document.querySelector(".online-scroll");
onlineScroll?.addEventListener("scroll", scheduleTracklistWindows, { passive: true });
// The panel's size changes with the window, and from nothing when its tab opens.
if (onlineScroll) new ResizeObserver(scheduleTracklistWindows).observe(onlineScroll);

// A table that stops matching its layout has changed row height with no scroll
// to notice it by: a font size set in Settings, a zoom. It is laid out again.
const tracklistResize = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const card = entry.target.closest(".release-card");
    if (!card || !entry.contentRect.height || tracklistDrift(card) <= 2) continue;
    renderWindow(card, true);
    fixTrackColumnWidth(card);
  }
});

// The table took the width of its longest row, which with only some rows drawn
// would change as the list scrolls. The widest title and section label are
// measured in their own fonts instead and set as the column's minimum.
let measureCanvas = null;
function fixTrackColumnWidth(card) {
  const state = tracklistState.get(card);
  const table = card.querySelector(".release-tracklist table");
  const sample = card.querySelector(".release-tracklist .tk-t");
  if (!state || !table || !sample) return;
  // A face first used by these rows is still loading, and a canvas would measure
  // its fallback. Measured again once it is in.
  if (document.fonts.status === "loading") document.fonts.ready.then(() => fixTrackColumnWidth(card));
  measureCanvas ||= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  const fontOf = (el) => {
    const style = getComputedStyle(el);
    return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  };
  ctx.font = fontOf(sample);
  const dot = ctx.measureText("·").width;
  const { release } = state;
  let track = 0;
  for (const t of release.tracks) {
    let w = ctx.measureText(t.title || "").width;
    // Title, a 5 px gap, then "·", 5 px and the artist (.tk-a and its ::before).
    if (t.artist && t.artist !== release.artist) w += 5 + dot + 5 + ctx.measureText(t.artist).width;
    track = Math.max(track, w);
  }
  table.style.setProperty("--tk-track-min", `${Math.ceil(track) + 1}px`);
  const sectionLabel = card.querySelector(".release-tracklist .tk-section-label");
  if (sectionLabel) {
    ctx.font = fontOf(sectionLabel);
    let widest = 0;
    for (const row of state.rows) if (row.section !== undefined) widest = Math.max(widest, ctx.measureText(row.section).width);
    table.style.setProperty("--tk-section-min", `${Math.ceil(widest) + 1}px`);
  }
}

function releaseArtworkMenu(card, release) {
  const existing = card.querySelector('.tk-save-menu');
  if (existing) return existing;
  const images = release.images || [];
  const menu = document.createElement('div');
  menu.className = 'col-menu tk-save-menu';
  menu.hidden = true;
  menu.innerHTML = `
    <button type="button" class="col-menu-row tk-menu-item" data-act="embed">${t("online.embedSelected")}</button>
    ${images.length ? `<button type="button" class="col-menu-row tk-menu-item" data-act="save-cover">${t("online.saveAsFolder")}</button>` : ""}
    ${images.length > 1 ? `<button type="button" class="col-menu-row tk-menu-item" data-act="save-all">${t("online.saveAll", { images: tn("unit.image", images.length) })}</button>` : ""}`;
  // Artwork actions belong to the card, independently of its hidden tracklist.
  card.append(menu);
  return menu;
}

function renderTracklist(card, release) {
  releaseArtworkMenu(card, release);
  // A sub-section header row (#328) precedes the first track of each labelled
  // run — a Discogs heading or a MusicBrainz medium title. It carries no
  // checkbox and no duration, and stands in the list of rows to draw on its own.
  const rows = [];
  let lastSection = null;
  release.tracks.forEach((t, i) => {
    const section = t.section || null;
    if (section && section !== lastSection) rows.push({ section });
    lastSection = section;
    rows.push({ i });
  });
  tracklistState.set(card, {
    release,
    rows,
    // Every track starts ticked; the ticks live here, not in the rows.
    checked: new Uint8Array(release.tracks.length).fill(1),
    offsets: null, // where each drawn row starts, once a row of each kind is measured
    heights: null,
    start: -1,
    end: -1,
  });
  card.querySelector(".release-tracklist").innerHTML = `
    <div class="tracklist-scroll"><table>
      <thead><tr class="tk-head">
        <th class="tk-lead"><label class="tk-selall" title="${escapeHtml(t("online.selectAllTitle"))}"><input type="checkbox" class="tk-selall-box" aria-label="${escapeHtml(t("online.selectAllAria"))}" /></label></th>
        <th class="tk-selcount muted" colspan="2"><span class="tk-readout"><span class="tk-count">${escapeHtml(countLabel(card.dataset.id))}</span><span class="tk-tally"></span></span></th>
      </tr></thead>
      <tbody></tbody></table></div>`;
  upgradeComponentMarkup(card.querySelector('.release-tracklist'));
  // The import action moved to a header icon button (shown once loaded + expanded).
  card.classList.add("tracklist-loaded");
  renderWindow(card, true);
  fixTrackColumnWidth(card);
  tracklistResize.observe(card.querySelector(".release-tracklist table"));
  updateTracklistCount(card);
}

function updateTracklistCount(card) {
  const state = tracklistState.get(card);
  if (!state) return;
  const total = state.checked.length;
  const on = state.checked.reduce((sum, v) => sum + v, 0);
  const label = card.querySelector(".tk-tally");
  if (label) label.textContent = t("online.tally", { on, total });
  // Mirror the tally onto the master checkbox that replaced the Enable/Disable
  // all pair — same tri-state contract as the file table's #select-all, so the
  // control shows the current scope instead of just offering two commands.
  const master = card.querySelector(".tk-selall-box");
  if (master) {
    master.checked = total > 0 && on === total;
    master.indeterminate = on > 0 && on < total;
  }
}

// Enabled tracks stay in release order for sequential import.
function enabledTracksOf(card) {
  const state = tracklistState.get(card);
  if (!state) return [];
  const { release } = state;
  const ticked = [];
  state.checked.forEach((on, i) => {
    if (on) ticked.push(i);
  });
  return ticked.map((i) => {
    const t = release.tracks[i];
    return {
      position: t.position,
      // The disc the release puts this track on (#146), when it says.
      disc: t.disc ?? null,
      artist: t.artist || release.artist,
      title: t.title,
      duration_secs: t.duration_secs ?? null,
      isrc: t.isrc ?? null,
      // Tempo and key (#162) — stated only by a source that measures them.
      bpm: t.bpm ?? null,
      key: t.key ?? null,
    };
  });
}

// Fetch the full-size cover once (for embedding) and upgrade the card thumbnail.
async function loadFullCover(id, url, card) {
  if (!url || coverCache.has(id)) return;
  const source = releaseSource;
  const gen = searchGen;
  const token = await providerToken(source);
  try {
    const cover = await invoke("provider_fetch_image", { source, token, url });
    if (gen !== searchGen || coverCache.has(id)) return;
    coverCache.set(id, cover);
    const coverEl = card.querySelector(".release-cover");
    // Swap in the full-res cover without wiping the media badge (#98).
    if (coverEl) setCoverImage(coverEl, `data:${cover.mime};base64,${cover.data_base64}`);
  } catch (e) {
    /* embedding just won't be available for this card */
  }
}

// Artwork is a separate button beside the expand button: valid keyboard
// navigation without nesting one interactive control inside another.
async function pickReleaseArtwork(card) {
  if (artworkPickerOpen) return;
  artworkPickerOpen = true;
  const id = card.dataset.id;
  const source = releaseSource;
  const gen = searchGen;
  const trigger = card.querySelector(".release-cover");
  trigger.setAttribute("aria-busy", "true");
  try {
    const token = await providerToken(source);
    let release = releaseCache.get(id);
    if (!release) {
      release = await invoke("provider_fetch_release", { source, token, releaseId: id });
      if (gen !== searchGen) return;
      releaseCache.set(id, release);
    }
    const images = release.images?.length ? release.images :
      (release.cover_image_url ? [{ url: release.cover_image_url }] : []);
    if (!images.length) { toast(t("toast.online.noImages"), true); return; }
    let cache = artworkImages.get(id);
    if (!cache) artworkImages.set(id, (cache = new Map()));
    const canOpen = ["discogs", "musicbrainz", "beatport"].includes(source);
    const releaseUrl = canOpen ? (release.url || (source === "discogs" ? `https://www.discogs.com/release/${id}` : "")) : "";
    const releaseLink = (name) => ({ name, entity: "release", id, url: releaseUrl });
    const identities = (release.links || []).map((link) => ({
      name: link.name, entity: link.kind, id: link.id,
      url: `https://www.discogs.com/${link.kind}/${link.id}`,
    }));
    const artists = identities.filter((link) => link.entity === "artist");
    const labels = release.labels || [];
    const labelIndex = Number(card.querySelector(".label-picker")?.value || 0);
    const label = labels[labelIndex] || labels[0];
    const labelLink = label && (identities.find((link) => link.entity === "label" && link.name === label.name) || releaseLink(label.name));
    const artistLink = artists.length === 1 ? { ...artists[0], name: release.artist } : releaseLink(release.artist);
    const releaseName = label?.catalog_number ? `${label.catalog_number} — ${release.title}` : release.title;
    const links = releaseUrl ? [labelLink, artistLink, releaseLink(releaseName)].filter(Boolean) : [];
    const result = await chooseArtwork({
      title: `${release.artist} — ${release.title}`,
      links,
      openLink: async (link) => {
        try { await invoke("open_provider_page", { source, entity: link.entity, id: link.id }); }
        catch (error) { toast(String(error), true); }
      },
      images,
      selected: artworkChoices.get(id) || 0,
      rotations: artworkRotations.get(id) || {},
      fetchImage: (url) => {
        if (!cache.has(url)) cache.set(url,
          invoke("provider_fetch_image", { source, token, url }).catch((error) => {
            cache.delete(url);
            throw error;
          }));
        return cache.get(url);
      },
    });
    if (!result || gen !== searchGen) return;
    artworkChoices.set(id, result.index);
    artworkRotations.set(id, { ...(artworkRotations.get(id) || {}), [result.index]: result.rotation || 0 });
    coverCache.set(id, result.cover);
    const cover = coverElOf(id);
    if (cover) setCoverImage(cover, `data:${result.cover.mime};base64,${result.cover.data_base64}`);
    toast(t("artwork.chosen", { number: result.index + 1 }));
  } catch (error) {
    toast(String(error), true);
  } finally {
    trigger.removeAttribute("aria-busy");
    artworkPickerOpen = false;
  }
}

async function embedCoverFrom(card) {
  const subject = captureSelection();
  const paths = subject.paths;
  const release = releaseCache.get(card.dataset.id);
  await loadFullCover(card.dataset.id, release?.cover_image_url, card);
  const cover = coverCache.get(card.dataset.id);
  if (!cover) {
    toast(t("toast.online.noCover"), true);
    return;
  }
  if (paths.length === 0) {
    toast(t("toast.cover.selectEmbed"), true);
    return;
  }
  try {
    const plan = await invoke("preview_cover_embed", { paths, cover });
    if (!isSelectionCurrent(subject)) return;
    adoptLiveCoverPlan(plan, paths);
    toast(
      plan.changes.length
        ? t("toast.online.previewCover", { files: tn("unit.file", plan.changes.length) })
        : t("toast.cover.sameCover"),
    );
  } catch (e) {
    toast(String(e), true);
  }
}

// Save a release's image(s) to disk next to the selected tracks (#102). `all`
// saves every image (primary -> folder.jpg, then cover.jpg, cover-1.jpg…);
// otherwise just the primary. If the backend reports existing files, confirm
// before overwriting.
async function saveReleaseImages(card, all) {
  const id = card.dataset.id;
  const release = releaseCache.get(id);
  const images = (release && release.images) || [];
  if (!images.length) {
    toast(t("toast.online.noImages"), true);
    return;
  }
  const paths = selectedPaths();
  if (paths.length === 0) {
    toast(t("toast.online.selectSaveImages"), true);
    return;
  }
  const urls = all ? images.map((i) => i.url) : [images[0].url];
  const token = await providerToken(releaseSource);
  const args = { source: releaseSource, token, path: paths[0], urls, overwrite: false };
  try {
    let res = await invoke("save_release_images", args);
    if (res.conflicts && res.conflicts.length) {
      const ok = await confirmDialog(
        tn("online.conflicts", res.conflicts.length, { files: res.conflicts.join(", ") }),
        t("online.overwrite"),
      );
      if (!ok) return;
      res = await invoke("save_release_images", { ...args, overwrite: true });
    }
    toast(t("toast.online.savedImages", { images: tn("unit.image", res.written.length) }));
  } catch (e) {
    toast(String(e), true);
  }
}

let importPreviewActive = false;
let waitingImportPreview = null;
async function requestImportPreview(args, version, subject) {
  if (importPreviewActive) {
    const proceed = await new Promise(resolve => {
      waitingImportPreview?.(false);
      waitingImportPreview = resolve;
    });
    if (!proceed) return null;
  }
  if (!isLiveImportCurrent(version) || !isSelectionCurrent(subject)) return null;
  importPreviewActive = true;
  try { return await invoke('preview_import', args); }
  finally {
    importPreviewActive = false;
    const next = waitingImportPreview; waitingImportPreview = null; next?.(true);
  }
}

async function importRelease(card) {
  const captured = captureSelection();
  const subject = { ...captured, paths: hooks.orderPathsForDisplay(captured.paths) };
  const paths = subject.paths;
  if (paths.length === 0) {
    toast(t("toast.online.selectImport"), true);
    return;
  }
  const version = beginLiveImport();
  const release = releaseCache.get(card.dataset.id);
  // Prefer Discogs styles over coarse genres. Use the writer's multi-value
  // codec (default "; ") so these stay separate native values, while a slash
  // inside one provider genre (e.g. Pop/Rock) remains part of that value.
  const genreValues = release.styles.length ? release.styles : release.genres;
  const genreSeparator = savedSettings.multi_value_separator || "; ";
  // The chosen label / catalogue-number pair (#90): the picker's selection, or
  // the first pair when there's no picker (0 or 1 label).
  const labels = release.labels || [];
  const picker = card.querySelector(".label-picker");
  const chosen = labels[picker ? Number(picker.value) : 0];
  const selection = {
    album: release.title,
    album_artist: release.artist,
    year: release.year ? String(release.year) : null,
    genre: genreValues.join(genreSeparator) || null,
    tracks: enabledTracksOf(card),
    // Store the release id so the table can group by release (#20).
    release_id: release.id || null,
    source: releaseSource,
    label: chosen ? chosen.name : null,
    catalog_number: chosen ? chosen.catalog_number || null : null,
    country: release.country || null,
    // Total tracks on the release (album-level), so a file reads as N/total.
    track_total: release.tracks && release.tracks.length ? String(release.tracks.length) : null,
    // Discs in the set (album-level), so a file reads as N/total (#146). Only for
    // physical media: for a digital release `disc_total` holds the file count, not
    // a disc count, so writing it would put a bogus DiscTotal on every file (#339).
    disc_total:
      isPhysicalMedia(release.format) && release.disc_total ? String(release.disc_total) : null,
    url: release.url || null,
    // Physical medium → drives the vinyl side view (#106).
    media_type: mediaTagValue(release.format),
  };
  try {
    const preferences = await prepareImportPreferences();
    if (!isSelectionCurrent(subject) || !isLiveImportCurrent(version)) return;
    const imported = await requestImportPreview({
      paths,
      selection,
      vinylSidesToDisc: el("import-vinyl-disc").checked,
    }, version, subject);
    if (!imported || !isSelectionCurrent(subject) || !isLiveImportCurrent(version)) return;
    // Hand the release's cover to the staging step (#207) so the tags and the
    // artwork become ONE plan — one Apply, one undo. Whether any of it is
    // written is the backend's call: the import-cover setting decides, per
    // file, and "only when the file has none" is the default.
    //
    // Awaited, unlike the fire-and-forget fetch that expanding a card starts:
    // importing straight after expanding would otherwise race it and drop the
    // artwork silently, which is the one failure this feature must not have.
    if (preferences.import_cover !== 'never') await loadFullCover(card.dataset.id, release.cover_image_url, card);
    if (!isSelectionCurrent(subject) || !isLiveImportCurrent(version)) return;
    if (!replaceLiveImport(imported, preferences.import_cover !== 'never' ? coverCache.get(card.dataset.id) || null : null, paths, version)) return;
    refreshFieldEditor({force:true});
    await hooks.previewEdits();
  } catch (e) {
    if (isLiveImportCurrent(version)) toast(String(e), true);
  } finally { finishLiveImport(version); }
}

// ---- wire up ----
// The one search/stop button toggles by state (#111): stop while a search is
// working, otherwise start one. Enter always starts a search.
el("discogs-search").addEventListener("click", () => {
  if (searchBusy()) stopLoading();
  else discogsSearch();
});
el("discogs-query").addEventListener("keydown", (e) => e.key === "Enter" && discogsSearch());
el("query-presets").addEventListener("click", (e) => {
  e.stopPropagation();
  toggleQueryPresets();
});
document.addEventListener("click", (e) => {
  const menu = el("query-preset-menu");
  if (!menu.hidden && !menu.contains(e.target)) closeQueryPresets();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeQueryPresets();
});
el("load-more").addEventListener("click", loadMoreResults);
el("search-per-page").addEventListener("change", (e) => {
  const v = parseInt(e.target.value, 10);
  try {
    localStorage.setItem(PERPAGE_STORAGE_KEY, String(v));
  } catch (err) {
    /* localStorage unavailable — preference just won't persist */
  }
  // Re-run from page 1 at the new page size if we already have results.
  if (releaseCandidates.length) discogsSearch();
});

// Media-type filter (#103): re-run the search from page 1 when it changes and
// there's already a query in play.
el("search-format").addEventListener("change", () => {
  if (releaseCandidates.length || el("discogs-query").value.trim()) discogsSearch();
});

async function openReleaseArtworkMenu(event) {
  const trigger = event.target.closest('.release-cover');
  if (!trigger) return;
  if (event.type === 'keydown' && event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
  event.preventDefault(); event.stopPropagation();
  const card = trigger.closest('.release-card');
  if (!card) return;
  const request = ++artworkMenuRequest;
  const id = card.dataset.id, source = releaseSource, gen = searchGen;
  trigger.setAttribute('aria-busy', 'true');
  let menu;
  try {
    let release = releaseCache.get(id);
    if (!release) {
      const token = await providerToken(source);
      release = await invoke('provider_fetch_release', { source, token, releaseId:id });
      if (gen !== searchGen || !card.isConnected) return;
      releaseCache.set(id, release);
      updateMediaBadge(releaseCandidates.find(candidate => candidate.id === id) || { id, format:release.format });
    }
    if (request !== artworkMenuRequest || gen !== searchGen || !card.isConnected) return;
    menu = releaseArtworkMenu(card, release);
    // Let the shared menu shell mount before measuring its position.
    await Promise.resolve();
    if (request !== artworkMenuRequest || gen !== searchGen || !card.isConnected) return;
  } catch (error) { toast(String(error), true); return; }
  finally { trigger.removeAttribute('aria-busy'); }
  document.querySelectorAll('.tk-save-menu').forEach(other => { if (other !== menu) other.hidden = true; });
  menu.onkeydown = key => {
    if (key.key === 'Escape') { menu.hidden = true; trigger.focus({ preventScroll: true }); }
  };
  menu.hidden = false;
  if (event.type === 'keydown' || (!event.clientX && !event.clientY)) placeFloating(menu, trigger);
  else placeContextMenu(menu, event.clientX, event.clientY);
  queueMicrotask(() => menu.querySelector('button')?.focus({ preventScroll: true }));
}
el('release-list').addEventListener('contextmenu', openReleaseArtworkMenu);
el('release-list').addEventListener('keydown', openReleaseArtworkMenu);

// One delegated handler for every card interaction (they're re-rendered often).
el("release-list").addEventListener("click", (e) => {
  // The catalogue chip opens the release's provider page (#92) in both layouts;
  // caught before the tile/card handlers so it never also expands/switches.
  if (e.target.closest(".release-label-link, .rb-catno")) {
    const host = e.target.closest("[data-id]");
    if (host) openReleasePage(host.dataset.id);
    return;
  }
  const card = e.target.closest(".release-card");
  if (!card) return;
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "artwork") {
    pickReleaseArtwork(card);
  } else if (act === "embed") {
    card.querySelector(".tk-save-menu").hidden = true;
    embedCoverFrom(card);
  } else if (act === "save-cover" || act === "save-all") {
    // Reached either from the plain single-image button or a menu item; dismiss
    // the menu so it doesn't hang open over the toast.
    const menu = card.querySelector(".tk-save-menu");
    if (menu) menu.hidden = true;
    saveReleaseImages(card, act === "save-all");
  } else if (act === "import") {
    if (!releaseCache.has(card.dataset.id) || !tracklistState.has(card)) {
      toggleCard(card).then(() => { if (tracklistState.has(card)) importRelease(card); });
    } else importRelease(card);
  } else if (e.target.closest(".release-head")) {
    toggleCard(card);
  }
});

// Live "N / M selected" as track checkboxes toggle, plus the master checkbox
// that replaced the Enable all / Disable all pair: it drives every row from one
// control and re-derives its own tri-state from the tally.
el("release-list").addEventListener("change", (e) => {
  const card = e.target.closest(".release-card");
  if (!card) return;
  const state = tracklistState.get(card);
  if (!state) return;
  if (e.target.matches(".tk-selall-box")) {
    state.checked.fill(e.target.checked ? 1 : 0);
    renderWindow(card, true);
    updateTracklistCount(card);
  } else if (e.target.matches(".release-tracklist tbody .tk-lead input")) {
    state.checked[Number(e.target.dataset.i)] = e.target.checked ? 1 : 0;
    updateTracklistCount(card);
  }
});

// Outside-click closes an open save menu, matching the Columns/Presets popovers.
document.addEventListener("click", (e) => {
  document.querySelectorAll(".tk-save-menu:not([hidden])").forEach((menu) => {
    if (!menu.contains(e.target)) menu.hidden = true;
  });
});

// A family can change width without changing row height. Re-measure only the
// expanded release cards after the interface face changes/finishes loading.
document.addEventListener("tagrex:interfacefont", () => {
  for (const card of releaseList().querySelectorAll('.release-card[aria-expanded="true"]')) fixTrackColumnWidth(card);
});

// A language switch: the cards and their open tracklists are built at run time, so
// they are drawn again from the cache (#476).
function retranslateOnline() {
  if (releaseCandidates.length > 0) renderReleaseList();
}

export { loadSavedToken, refreshReleaseMatches, retranslateOnline, searchBusy, searchPerPage, stopLoading };
