//! Telling the user that a newer TagRex exists (#435).
//!
//! One request to the GitHub Releases API for the latest published release,
//! compared with the running version. Nothing about the user or their files is
//! sent beyond what any HTTPS request carries (an address and a user agent
//! naming the version).
//!
//! When that release is newer, the updater plugin reads its `latest.json` too
//! (#602): if the release has a signed bundle for this platform and install
//! type, the notice can offer to install it. Nothing is downloaded until the
//! user asks for it.

use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Where the releases are, and the page the notice opens.
const LATEST_API: &str = "https://api.github.com/repos/tagrex/tagrex/releases/latest";
pub const RELEASES_PAGE: &str = "https://github.com/tagrex/tagrex/releases/latest";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct UpdateCheckDto {
    /// The version this build is.
    pub current: String,
    /// The latest published release, without a leading `v`.
    pub latest: String,
    /// Whether `latest` is newer than `current`.
    pub newer: bool,
    /// Whether `latest` can be installed from inside the app (#602): its release
    /// has a signed update bundle for this platform and install type.
    pub installable: bool,
}

/// The update the last check found installable (#602), held for Install.
#[derive(Default)]
pub struct PendingUpdate(pub Mutex<Option<Update>>);

/// `0.21.0`, `v0.21.0` or `0.21.0-rc1` as numbers, the pre-release suffix
/// dropped. `None` for anything that does not start with a dotted number.
fn parse_version(text: &str) -> Option<(u64, u64, u64)> {
    let core = text.trim().trim_start_matches('v');
    let core = core.split(['-', '+']).next().unwrap_or(core);
    let mut parts = core.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

/// Whether `latest` is a newer release than `current`. An answer either side of
/// which cannot be read is "no": a notice that might be wrong is worse than none.
fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(latest), Some(current)) => latest > current,
        _ => false,
    }
}

/// Ask GitHub for the latest release. Honours the proxy of the network settings.
pub fn check(proxy: &str) -> Result<UpdateCheckDto, String> {
    let current = env!("CARGO_PKG_VERSION");
    let mut builder = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .timeout_global(Some(Duration::from_secs(10)));
    if !proxy.trim().is_empty() {
        let proxy =
            ureq::Proxy::new(proxy.trim()).map_err(|error| format!("invalid proxy: {error}"))?;
        builder = builder.proxy(Some(proxy));
    }
    let agent = ureq::Agent::new_with_config(builder.build());
    let mut response = agent
        .get(LATEST_API)
        .header("User-Agent", &format!("TagRex/{current}"))
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    if status != 200 {
        return Err(format!("GitHub answered {status}"));
    }
    let body = response
        .body_mut()
        .read_to_string()
        .map_err(|error| error.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;
    let tag = json
        .get("tag_name")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "GitHub's answer has no release tag".to_string())?;
    let latest = tag.trim_start_matches('v').to_string();
    Ok(UpdateCheckDto {
        newer: is_newer(&latest, current),
        current: current.to_string(),
        latest,
        installable: false,
    })
}

/// The proxy of the network settings as the updater's client takes it: a URL,
/// `http://` assumed when the setting is a bare `host:port`.
fn proxy_url(proxy: &str) -> Option<Url> {
    let proxy = proxy.trim();
    if proxy.is_empty() {
        return None;
    }
    Url::parse(proxy)
        .ok()
        .filter(|url| url.has_host())
        .or_else(|| Url::parse(&format!("http://{proxy}")).ok())
}

/// The installable update for `latest`, read from its release's `latest.json`
/// (#602). `None` whenever that is not on offer, for whatever reason: a release
/// published before there were update bundles, no bundle for this target (a
/// build that was not installed from a package), a `latest.json` that names
/// another version, or no answer at all. The notice then stays what it was, a
/// way to the release page.
pub async fn installable(app: &AppHandle, proxy: &str, latest: &str) -> Option<Update> {
    let mut builder = app.updater_builder().timeout(Duration::from_secs(10));
    if let Some(url) = proxy_url(proxy) {
        builder = builder.proxy(url);
    }
    let update = builder.build().ok()?.check().await.ok()??;
    let same = parse_version(&update.version).is_some()
        && parse_version(&update.version) == parse_version(latest);
    same.then_some(update)
}

#[cfg(test)]
mod tests {
    use super::{is_newer, parse_version, proxy_url};

    #[test]
    fn versions_read_with_or_without_a_v_and_a_suffix() {
        assert_eq!(parse_version("0.21.0"), Some((0, 21, 0)));
        assert_eq!(parse_version("v1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("0.21.0-rc1"), Some((0, 21, 0)));
        assert_eq!(parse_version("0.21"), Some((0, 21, 0)));
        assert_eq!(parse_version("nightly"), None);
    }

    #[test]
    fn newer_means_strictly_newer_by_number_not_by_text() {
        assert!(is_newer("0.21.0", "0.20.0"));
        assert!(is_newer("0.10.0", "0.9.5"));
        assert!(is_newer("1.0.0", "0.99.99"));
        assert!(!is_newer("0.20.0", "0.20.0"));
        assert!(!is_newer("0.19.9", "0.20.0"));
    }

    /// Reaches the real API, so it only runs when asked for:
    /// `cargo test -p tagrex update -- --ignored`.
    #[test]
    #[ignore]
    fn the_latest_release_can_be_read_from_github() {
        let found = super::check("").expect("GitHub answers");
        assert!(super::parse_version(&found.latest).is_some(), "{found:?}");
    }

    #[test]
    fn a_bare_proxy_is_read_as_an_http_one() {
        assert_eq!(proxy_url(""), None);
        assert_eq!(
            proxy_url("proxy.local:3128").map(|url| url.to_string()),
            Some("http://proxy.local:3128/".to_string())
        );
        assert_eq!(
            proxy_url("socks5://127.0.0.1:1080").map(|url| url.to_string()),
            Some("socks5://127.0.0.1:1080".to_string())
        );
    }

    #[test]
    fn an_unreadable_version_never_announces_an_update() {
        assert!(!is_newer("nightly", "0.20.0"));
        assert!(!is_newer("0.21.0", "dev"));
    }
}
