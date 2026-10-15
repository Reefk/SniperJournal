// no console window behind the app in a release build
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  sniper_journal_lib::run();
}
