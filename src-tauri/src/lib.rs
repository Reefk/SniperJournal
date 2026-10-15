//! Sniper Journal for Windows: one window showing the static export in out/
//! (the same pages as the Android app), and the commands its storage,
//! src/lib/storage/tauri.ts, calls to keep the journal in
//! Documents\Sniper Journal. Nothing here talks to the network.

mod folder;

use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use folder::{Entry, Folder};
use serde::Serialize;
use tauri::http::{Response, StatusCode, header};
use tauri::ipc::{InvokeBody, Request};
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Emitter, Manager, State, Url, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

type Answer<T> = Result<T, String>;

fn said(err: std::io::Error) -> String {
  err.to_string()
}

// ---- the journal folder ----------------------------------------------------

#[tauri::command(async)]
fn journal_folder(folder: State<Folder>) -> String {
  folder.root.to_string_lossy().into_owned()
}

#[tauri::command(async)]
fn read_text(folder: State<Folder>, path: String) -> Answer<Option<String>> {
  folder::read_text(&folder.inside(&path)?).map_err(said)
}

#[tauri::command(async)]
fn write_text(folder: State<Folder>, path: String, text: String) -> Answer<()> {
  folder::write_atomically(&folder.inside(&path)?, text.as_bytes()).map_err(said)
}

/// Copies a file, unless the target is already there (false then).
#[tauri::command(async)]
fn copy_new(folder: State<Folder>, from: String, to: String) -> Answer<bool> {
  let (from, to) = (folder.inside(&from)?, folder.inside(&to)?);
  if to.exists() {
    return Ok(false);
  }
  let bytes = folder::patiently(|| std::fs::read(&from)).map_err(said)?;
  folder::write_atomically(&to, &bytes).map_err(said)?;
  Ok(true)
}

#[tauri::command(async)]
fn list(folder: State<Folder>, dir: String) -> Answer<Vec<Entry>> {
  folder::list(&folder.inside(&dir)?).map_err(said)
}

#[tauri::command(async)]
fn remove(folder: State<Folder>, path: String) -> Answer<bool> {
  folder::remove(&folder.inside(&path)?).map_err(said)
}

/// A chart image, sent as the raw bytes of the call with its name in a header.
#[tauri::command(async)]
fn save_image(folder: State<Folder>, request: Request<'_>) -> Answer<()> {
  let name = request
    .headers()
    .get("x-name")
    .and_then(|v| v.to_str().ok())
    .unwrap_or("");
  let path = folder.image(name).ok_or("Not a chart image name.")?;
  let InvokeBody::Raw(bytes) = request.body() else {
    return Err("No image was sent.".into());
  };
  folder::write_atomically(&path, bytes).map_err(said)
}

// ---- files the person picks ------------------------------------------------

/// "Save as" for an export or a backup; the path it went to, or None when the
/// dialog was closed without saving.
#[tauri::command(async)]
fn save_as(app: AppHandle, filename: String, content: String) -> Answer<Option<String>> {
  let ext = filename
    .rsplit_once('.')
    .map(|(_, e)| e.to_ascii_lowercase())
    .unwrap_or_default();
  let mut dialog = app.dialog().file().set_file_name(&filename);
  if let Ok(downloads) = app.path().download_dir() {
    dialog = dialog.set_directory(downloads);
  }
  if !ext.is_empty() {
    dialog = dialog.add_filter(ext.to_uppercase(), &[ext.as_str()]);
  }
  let Some(picked) = dialog.blocking_save_file() else {
    return Ok(None);
  };
  let path = picked.into_path().map_err(|e| e.to_string())?;
  std::fs::write(&path, content).map_err(said)?;
  Ok(Some(path.to_string_lossy().into_owned()))
}

#[derive(Serialize)]
struct OldJournal {
  text: String,
  /// the folder it was found in, for `import_old_images`
  folder: String,
}

/// The journal kept by the version that ran its own server: the person picks
/// that app's folder (or the data folder inside it) and its journal is read.
/// The pages then restore it the way they restore a backup. None when no
/// folder was picked.
#[tauri::command(async)]
fn import_old(app: AppHandle) -> Answer<Option<OldJournal>> {
  let Some(picked) = app
    .dialog()
    .file()
    .set_title("Choose the folder of your earlier Sniper Journal")
    .blocking_pick_folder()
  else {
    return Ok(None);
  };
  let picked = picked.into_path().map_err(|e| e.to_string())?;
  let data = folder::old_data_folder(&picked).ok_or(
    "There is no journal in that folder. Choose the Sniper Journal folder you installed before, the one with INSTALLER.bat in it.",
  )?;
  let text = folder::read_text(&data.join("journal.json"))
    .map_err(said)?
    .ok_or("The journal in that folder could not be read.")?;
  Ok(Some(OldJournal {
    text,
    folder: data.to_string_lossy().into_owned(),
  }))
}

/// Copies the chart images of a journal `import_old` found into this folder,
/// leaving any already here alone, and says how many it copied. Only files
/// named the way the app names images are touched.
#[tauri::command(async)]
fn import_old_images(folder: State<Folder>, from: String) -> Answer<usize> {
  let data = folder::old_data_folder(std::path::Path::new(&from)).ok_or("That folder has no journal in it.")?;
  let mut images = 0;
  for entry in folder::list(&data.join("screenshots")).map_err(said)? {
    let Some(target) = folder.image(&entry.name).filter(|_| entry.is_file) else {
      continue;
    };
    if target.exists() {
      continue;
    }
    let bytes = std::fs::read(data.join("screenshots").join(&entry.name)).map_err(said)?;
    folder::write_atomically(&target, &bytes).map_err(said)?;
    images += 1;
  }
  Ok(images)
}

// ---- closing -----------------------------------------------------------------

/// Set once the pages are ready to save a change still waiting out its pause
/// when the window is closed (`guard_close`), and once closing has begun.
#[derive(Default)]
struct Closing {
  guarded: AtomicBool,
  begun: AtomicBool,
}

#[tauri::command]
fn guard_close(closing: State<Closing>) {
  closing.guarded.store(true, Ordering::SeqCst);
}

/// Called by the pages once the last change is saved.
#[tauri::command]
fn close_now(window: WebviewWindow) {
  let _ = window.destroy();
}

/// How long a close waits for the pages before it goes ahead anyway.
const CLOSE_WAIT: Duration = Duration::from_secs(5);

// ---- the window ----------------------------------------------------------------

/// The app's own pages: the built-in origin, or the dev server while working on it.
fn own_page(url: &Url) -> bool {
  let built_in = matches!(
    (url.scheme(), url.host_str()),
    ("tauri", _) | ("http" | "https", Some("tauri.localhost"))
  );
  let dev_server = matches!(
    (url.scheme(), url.host_str()),
    ("http", Some("localhost" | "127.0.0.1"))
  );
  built_in || (dev_server && cfg!(debug_assertions))
}

/// A link to a website (a trading idea's chart, say) opens in the person's
/// browser rather than inside the app.
fn open_outside(app: &AppHandle, url: &Url) {
  if matches!(url.scheme(), "http" | "https" | "mailto") {
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
  }
}

fn chart_image(app: &AppHandle, request: &tauri::http::Request<Vec<u8>>) -> Response<Vec<u8>> {
  let name = request.uri().path().trim_start_matches('/');
  let found = app
    .state::<Folder>()
    .image(name)
    .and_then(|path| folder::patiently(|| std::fs::read(&path)).ok());
  let Some(bytes) = found else {
    return Response::builder()
      .status(StatusCode::NOT_FOUND)
      .body(Vec::new())
      .unwrap();
  };
  let ext = name
    .rsplit_once('.')
    .map(|(_, e)| e.to_ascii_lowercase())
    .unwrap_or_default();
  let kind = match ext.as_str() {
    "png" => "image/png",
    "jpg" | "jpeg" => "image/jpeg",
    "webp" => "image/webp",
    _ => "image/gif",
  };
  Response::builder()
    .header(header::CONTENT_TYPE, kind)
    .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
    .body(bytes)
    .unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // a second launch brings the open window forward instead of opening a
    // second one writing the same journal
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .manage(Closing::default())
    // chart images, at http://chart.localhost/<name>
    .register_asynchronous_uri_scheme_protocol("chart", |ctx, request, responder| {
      let app = ctx.app_handle().clone();
      thread::spawn(move || responder.respond(chart_image(&app, &request)));
    })
    .setup(|app| {
      let root = folder::locate(app.path().document_dir().ok()).map_err(|e| format!("The journal folder: {e}"))?;
      app.manage(Folder { root });

      let config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or("no window in tauri.conf.json")?;
      let nav = app.handle().clone();
      let popup = app.handle().clone();
      WebviewWindowBuilder::from_config(app.handle(), &config)?
        .on_navigation(move |url| {
          let own = own_page(url);
          if !own {
            open_outside(&nav, url);
          }
          own
        })
        .on_new_window(move |url, _| {
          open_outside(&popup, &url);
          NewWindowResponse::Deny
        })
        .build()?;
      Ok(())
    })
    .on_window_event(|window, event| {
      let WindowEvent::CloseRequested { api, .. } = event else {
        return;
      };
      let closing = window.state::<Closing>();
      // pages that never got as far as saving anything, and a second click on
      // close while the first waits, close straight away
      if !closing.guarded.load(Ordering::SeqCst) || closing.begun.swap(true, Ordering::SeqCst) {
        return;
      }
      api.prevent_close();
      let _ = window.emit("sniper://closing", ());
      let window = window.clone();
      thread::spawn(move || {
        thread::sleep(CLOSE_WAIT);
        let _ = window.destroy();
      });
    })
    .invoke_handler(tauri::generate_handler![
      journal_folder,
      read_text,
      write_text,
      copy_new,
      list,
      remove,
      save_image,
      save_as,
      import_old,
      import_old_images,
      guard_close,
      close_now,
    ])
    .run(tauri::generate_context!())
    .expect("Sniper Journal could not start");
}
