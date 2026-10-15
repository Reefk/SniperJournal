//! The journal folder, Documents\Sniper Journal, and the only file operations
//! the app's pages can ask for. The rules of what is kept where (daily
//! backups, pruning, which images are unused) live in
//! src/lib/storage/tauri.ts, as they do for the phone; this side only makes
//! sure every operation stays inside the folder and that a write can never
//! leave half a file behind.
//!
//!   journal.json   the whole journal
//!   backups\       one copy per day, plus copies kept before a restore or erase
//!   screenshots\   chart images, referenced by name from each trade

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread::sleep;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;

pub struct Folder {
  pub root: PathBuf,
}

/// The folder Sniper Journal keeps everything in. A development build
/// (`npm run desktop`) keeps its own, so working on the app never writes to
/// the journal you use. `SNIPER_JOURNAL_DIR` points either somewhere else,
/// which the end-to-end test uses so that it never touches a real journal.
pub fn locate(documents: Option<PathBuf>) -> io::Result<PathBuf> {
  let name = if cfg!(debug_assertions) {
    "Sniper Journal (development)"
  } else {
    "Sniper Journal"
  };
  let root = match std::env::var_os("SNIPER_JOURNAL_DIR") {
    Some(dir) if !dir.is_empty() => PathBuf::from(dir),
    _ => documents
      .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no Documents folder"))?
      .join(name),
  };
  fs::create_dir_all(&root)?;
  Ok(root)
}

const TOP: [&str; 3] = ["journal.json", "backups", "screenshots"];
const RESERVED: [&str; 4] = ["CON", "PRN", "AUX", "NUL"];

/// One plain file or folder name: letters, digits, dot, dash and underscore,
/// not starting with a dot, and not a name Windows keeps for a device.
fn plain(segment: &str) -> bool {
  let stem = segment.split('.').next().unwrap_or("").to_ascii_uppercase();
  let device = RESERVED.contains(&stem.as_str())
    || ((stem.starts_with("COM") || stem.starts_with("LPT")) && stem.len() == 4 && stem.as_bytes()[3].is_ascii_digit());
  !segment.is_empty()
    && !segment.starts_with('.')
    && !device
    && segment
      .bytes()
      .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'_')
}

/// A name the app gives a chart image (IMAGE_NAME in src/lib/storage/sweep.ts).
pub fn image_name(name: &str) -> bool {
  let Some((stem, ext)) = name.rsplit_once('.') else {
    return false;
  };
  (6..=40).contains(&stem.len())
    && stem.bytes().all(|b| b.is_ascii_alphanumeric())
    && ["png", "jpg", "jpeg", "webp", "gif"].contains(&ext.to_ascii_lowercase().as_str())
}

impl Folder {
  /// A path the pages name, such as "backups/journal-2026-10-15.json", inside
  /// the folder; refused when it could reach anywhere else.
  pub fn inside(&self, path: &str) -> Result<PathBuf, String> {
    let parts: Vec<&str> = path.split('/').collect();
    let ok = match parts.as_slice() {
      [top] => TOP.contains(top),
      [dir, name] => (*dir == "backups" || *dir == "screenshots") && plain(name),
      _ => false,
    };
    if !ok {
      return Err(format!("Not a path inside the journal folder: {path}"));
    }
    Ok(parts.iter().fold(self.root.clone(), |p, s| p.join(s)))
  }

  pub fn image(&self, name: &str) -> Option<PathBuf> {
    image_name(name).then(|| self.root.join("screenshots").join(name))
  }
}

/// What Windows answers while antivirus or a sync tool (OneDrive) has a file
/// open for a moment: access denied, sharing violation, lock violation.
/// Worth waiting out; anything else is not.
fn held(err: &io::Error) -> bool {
  matches!(err.raw_os_error(), Some(5 | 32 | 33)) || err.kind() == io::ErrorKind::PermissionDenied
}

const RETRIES_MS: [u64; 5] = [50, 100, 200, 400, 800];

pub fn patiently<T>(mut task: impl FnMut() -> io::Result<T>) -> io::Result<T> {
  let mut attempt = 0;
  loop {
    match task() {
      Err(err) if held(&err) && attempt < RETRIES_MS.len() => {
        sleep(Duration::from_millis(RETRIES_MS[attempt]));
        attempt += 1;
      }
      other => return other,
    }
  }
}

/// A file's text, or None when it is not there.
pub fn read_text(path: &Path) -> io::Result<Option<String>> {
  match patiently(|| fs::read_to_string(path)) {
    Ok(text) => Ok(Some(text)),
    Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(None),
    Err(err) => Err(err),
  }
}

/// Writes to a temp file of its own, waits until its bytes are on the disk,
/// then renames it over the target, so a crash mid-write leaves either the
/// old file or the new one, never half of one.
pub fn write_atomically(target: &Path, bytes: &[u8]) -> io::Result<()> {
  static COUNTER: AtomicU64 = AtomicU64::new(0);
  if let Some(dir) = target.parent() {
    fs::create_dir_all(dir)?;
  }
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_nanos())
    .unwrap_or(0);
  let name = target.file_name().and_then(|n| n.to_str()).unwrap_or("file");
  let tmp = target.with_file_name(format!(
    "{name}.{nanos:x}{:x}.tmp",
    COUNTER.fetch_add(1, Ordering::Relaxed)
  ));
  let result = (|| {
    let mut file = File::create(&tmp)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    drop(file);
    patiently(|| fs::rename(&tmp, target))
  })();
  if result.is_err() {
    let _ = fs::remove_file(&tmp);
  }
  result
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
  pub name: String,
  pub is_file: bool,
  /// last modified, in milliseconds since 1970
  pub modified: f64,
  pub bytes: u64,
}

/// What is in a folder; nothing when the folder is not there yet.
pub fn list(dir: &Path) -> io::Result<Vec<Entry>> {
  let entries = match fs::read_dir(dir) {
    Ok(entries) => entries,
    Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
    Err(err) => return Err(err),
  };
  let mut out = Vec::new();
  for entry in entries {
    let entry = entry?;
    let meta = entry.metadata()?;
    let modified = meta
      .modified()
      .ok()
      .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
      .map(|d| d.as_millis() as f64)
      .unwrap_or(0.0);
    out.push(Entry {
      name: entry.file_name().to_string_lossy().into_owned(),
      is_file: meta.is_file(),
      modified,
      bytes: meta.len(),
    });
  }
  Ok(out)
}

/// Deletes a file; false when it was not there.
pub fn remove(path: &Path) -> io::Result<bool> {
  match patiently(|| fs::remove_file(path)) {
    Ok(()) => Ok(true),
    Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(false),
    Err(err) => Err(err),
  }
}

/// The journal of the version that ran its own server, in the folder the
/// person picked: either that app's folder or the data folder inside it.
pub fn old_data_folder(picked: &Path) -> Option<PathBuf> {
  [picked.join("data"), picked.to_path_buf()]
    .into_iter()
    .find(|dir| dir.join("journal.json").is_file())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn folder() -> Folder {
    Folder {
      root: PathBuf::from("C:\\journal"),
    }
  }

  #[test]
  fn paths_stay_inside_the_folder() {
    let f = folder();
    assert!(f.inside("journal.json").is_ok());
    assert!(f.inside("backups").is_ok());
    assert!(f.inside("backups/journal-2026-10-15.json").is_ok());
    assert!(f.inside("screenshots/abc123def.png").is_ok());
    for bad in [
      "",
      "..",
      "../journal.json",
      "backups/../../x",
      "backups/..",
      "backups/.hidden",
      "C:/Windows/win.ini",
      "/journal.json",
      "backups\\x.json",
      "other/x.json",
      "backups/a/b.json",
      "notes.txt",
      "backups/con.json",
      "backups/COM1.json",
    ] {
      assert!(f.inside(bad).is_err(), "{bad} should be refused");
    }
  }

  #[test]
  fn image_names_match_the_app() {
    for good in [
      "abcdef.png",
      "ABC123def.JPG",
      "a1b2c3d4e5.jpeg",
      "zzzzzz.webp",
      "qwerty.gif",
    ] {
      assert!(image_name(good), "{good}");
    }
    for bad in [
      "abc.png",
      "abcdef.svg",
      "abc-def.png",
      "abcdef",
      "../abcdef.png",
      "abcdef.png.tmp",
    ] {
      assert!(!image_name(bad), "{bad}");
    }
  }

  #[test]
  fn a_write_replaces_the_file_whole() {
    let dir = std::env::temp_dir().join(format!("sj-folder-test-{}", std::process::id()));
    let file = dir.join("journal.json");
    write_atomically(&file, b"first").unwrap();
    write_atomically(&file, b"second").unwrap();
    assert_eq!(read_text(&file).unwrap().as_deref(), Some("second"));
    // no temp files are left behind
    assert_eq!(list(&dir).unwrap().len(), 1);
    assert!(remove(&file).unwrap());
    assert!(!remove(&file).unwrap());
    assert_eq!(read_text(&file).unwrap(), None);
    fs::remove_dir_all(&dir).unwrap();
  }
}
