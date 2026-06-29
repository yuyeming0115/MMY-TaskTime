#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State, Window, WindowEvent, LogicalPosition, Position, Emitter, LogicalSize, Size,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState, GlobalShortcutExt};

struct TrayState(Mutex<Option<tauri::tray::TrayIcon>>);

#[derive(Debug, Clone, Copy, PartialEq)]
enum EdgeDirection {
    Left,
    Right,
    Top,
}

struct SnapState {
    snapped: bool,
    direction: Option<EdgeDirection>,
    restore_position: Option<(i32, i32)>,
}

struct AppState {
    snap: Mutex<SnapState>,
    autostart_enabled: Mutex<bool>,
}

#[tauri::command]
fn set_always_on_top(window: Window, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_size(window: Window, width: i32, height: i32) -> Result<(), String> {
    window.set_size(Size::Logical(LogicalSize { width: width as f64, height: height as f64 }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_window_size(window: Window) -> Result<(i32, i32), String> {
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let logical = size.to_logical::<i32>(scale);
    Ok((logical.width, logical.height))
}

#[tauri::command]
fn set_window_resizable(window: Window, resizable: bool) -> Result<(), String> {
    window.set_resizable(resizable).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_position(window: Window, x: i32, y: i32) -> Result<(), String> {
    window.set_position(Position::Logical(LogicalPosition { x: x as f64, y: y as f64 }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_window_position(window: Window) -> Result<(i32, i32), String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    Ok((position.x, position.y))
}

#[tauri::command]
fn hide_window(window: Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
fn show_window(window: Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_window(window: Window) -> Result<(), String> {
    if window.is_visible().map_err(|e| e.to_string())? {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_skip_taskbar(window: Window, skip: bool) -> Result<(), String> {
    window.set_skip_taskbar(skip).map_err(|e| e.to_string())
}

#[tauri::command]
fn enable_autostart(app: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
    let autostart_manager = app.autolaunch();
    autostart_manager.enable().map_err(|e| e.to_string())?;
    *state.autostart_enabled.lock().unwrap() = true;
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.emit("autostart-changed", true);
    }
    Ok(())
}

#[tauri::command]
fn disable_autostart(app: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
    let autostart_manager = app.autolaunch();
    autostart_manager.disable().map_err(|e| e.to_string())?;
    *state.autostart_enabled.lock().unwrap() = false;
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.emit("autostart-changed", false);
    }
    Ok(())
}

#[tauri::command]
fn is_autostart_enabled(state: State<AppState>) -> Result<bool, String> {
    Ok(*state.autostart_enabled.lock().unwrap())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_tray_tooltip(tray_state: State<TrayState>, tooltip: String) -> Result<(), String> {
    if let Some(tray) = tray_state.0.lock().unwrap().as_ref() {
        tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn snap_check(window: Window, state: State<AppState>) -> Result<bool, String> {
    let monitor = window.current_monitor().map_err(|e| e.to_string())?;
    let monitor = match monitor {
        Some(m) => m,
        None => return Ok(false),
    };

    let mon_size = monitor.size();
    let mon_pos = monitor.position();
    let win_pos = window.outer_position().map_err(|e| e.to_string())?;
    let win_size = window.outer_size().map_err(|e| e.to_string())?;

    let scale = monitor.scale_factor();
    let mon_w = mon_size.to_logical::<i32>(scale).width;
    let mon_x = mon_pos.to_logical::<i32>(scale).x;
    let mon_y = mon_pos.to_logical::<i32>(scale).y;
    let win_w = win_size.to_logical::<i32>(scale).width;
    let win_h = win_size.to_logical::<i32>(scale).height;

    const EDGE_THRESHOLD: i32 = 5;
    const SNAP_REVEAL: i32 = 3;

    let win_x = win_pos.x;
    let win_y = win_pos.y;
    let rel_x = win_x - mon_x;
    let rel_y = win_y - mon_y;

    let mut snap_state = state.snap.lock().unwrap();

    if rel_x <= EDGE_THRESHOLD {
        snap_state.snapped = true;
        snap_state.direction = Some(EdgeDirection::Left);
        snap_state.restore_position = Some((win_x, win_y));
        drop(snap_state);
        window.set_position(Position::Logical(LogicalPosition {
            x: (mon_x - win_w + SNAP_REVEAL) as f64,
            y: win_y as f64,
        })).map_err(|e| e.to_string())?;
        return Ok(true);
    }

    if rel_x + win_w >= mon_w - EDGE_THRESHOLD {
        snap_state.snapped = true;
        snap_state.direction = Some(EdgeDirection::Right);
        snap_state.restore_position = Some((win_x, win_y));
        drop(snap_state);
        window.set_position(Position::Logical(LogicalPosition {
            x: (mon_x + mon_w - SNAP_REVEAL) as f64,
            y: win_y as f64,
        })).map_err(|e| e.to_string())?;
        return Ok(true);
    }

    if rel_y <= EDGE_THRESHOLD {
        snap_state.snapped = true;
        snap_state.direction = Some(EdgeDirection::Top);
        snap_state.restore_position = Some((win_x, win_y));
        drop(snap_state);
        window.set_position(Position::Logical(LogicalPosition {
            x: win_x as f64,
            y: (mon_y - win_h + SNAP_REVEAL) as f64,
        })).map_err(|e| e.to_string())?;
        return Ok(true);
    }

    Ok(false)
}

#[tauri::command]
fn snap_show(window: Window, state: State<AppState>) -> Result<(), String> {
    let snap_state = state.snap.lock().unwrap();
    if !snap_state.snapped {
        return Ok(());
    }

    let monitor = window.current_monitor().map_err(|e| e.to_string())?;
    let monitor = match monitor {
        Some(m) => m,
        None => return Ok(()),
    };

    let mon_pos = monitor.position();
    let win_size = window.outer_size().map_err(|e| e.to_string())?;
    let scale = monitor.scale_factor();
    let mon_x = mon_pos.to_logical::<i32>(scale).x;
    let mon_y = mon_pos.to_logical::<i32>(scale).y;
    let mon_w = monitor.size().to_logical::<i32>(scale).width;
    let win_w = win_size.to_logical::<i32>(scale).width;

    let win_pos = window.outer_position().map_err(|e| e.to_string())?;
    let win_y = win_pos.y;

    match snap_state.direction {
        Some(EdgeDirection::Left) => {
            window.set_position(Position::Logical(LogicalPosition {
                x: mon_x as f64,
                y: win_y as f64,
            })).map_err(|e| e.to_string())?;
        }
        Some(EdgeDirection::Right) => {
            window.set_position(Position::Logical(LogicalPosition {
                x: (mon_x + mon_w - win_w) as f64,
                y: win_y as f64,
            })).map_err(|e| e.to_string())?;
        }
        Some(EdgeDirection::Top) => {
            window.set_position(Position::Logical(LogicalPosition {
                x: win_pos.x as f64,
                y: mon_y as f64,
            })).map_err(|e| e.to_string())?;
        }
        None => {}
    }

    Ok(())
}

#[tauri::command]
fn snap_hide(window: Window, state: State<AppState>) -> Result<(), String> {
    let snap_state = state.snap.lock().unwrap();
    if !snap_state.snapped {
        return Ok(());
    }

    let monitor = window.current_monitor().map_err(|e| e.to_string())?;
    let monitor = match monitor {
        Some(m) => m,
        None => return Ok(()),
    };

    let mon_pos = monitor.position();
    let win_size = window.outer_size().map_err(|e| e.to_string())?;
    let scale = monitor.scale_factor();
    let mon_x = mon_pos.to_logical::<i32>(scale).x;
    let mon_y = mon_pos.to_logical::<i32>(scale).y;
    let mon_w = monitor.size().to_logical::<i32>(scale).width;
    let win_w = win_size.to_logical::<i32>(scale).width;
    let win_h = win_size.to_logical::<i32>(scale).height;

    let win_pos = window.outer_position().map_err(|e| e.to_string())?;
    let win_y = win_pos.y;

    const SNAP_REVEAL: i32 = 3;

    match snap_state.direction {
        Some(EdgeDirection::Left) => {
            window.set_position(Position::Logical(LogicalPosition {
                x: (mon_x - win_w + SNAP_REVEAL) as f64,
                y: win_y as f64,
            })).map_err(|e| e.to_string())?;
        }
        Some(EdgeDirection::Right) => {
            window.set_position(Position::Logical(LogicalPosition {
                x: (mon_x + mon_w - SNAP_REVEAL) as f64,
                y: win_y as f64,
            })).map_err(|e| e.to_string())?;
        }
        Some(EdgeDirection::Top) => {
            window.set_position(Position::Logical(LogicalPosition {
                x: win_pos.x as f64,
                y: (mon_y - win_h + SNAP_REVEAL) as f64,
            })).map_err(|e| e.to_string())?;
        }
        None => {}
    }

    Ok(())
}

#[tauri::command]
fn edge_unsnap(window: Window, state: State<AppState>) -> Result<(), String> {
    let mut snap_state = state.snap.lock().unwrap();
    if !snap_state.snapped {
        return Ok(());
    }

    if let Some((x, y)) = snap_state.restore_position {
        window.set_position(Position::Logical(LogicalPosition {
            x: x as f64,
            y: y as f64,
        })).map_err(|e| e.to_string())?;
    }

    snap_state.snapped = false;
    snap_state.direction = None;
    snap_state.restore_position = None;

    Ok(())
}

#[tauri::command]
fn is_snapped(state: State<AppState>) -> Result<bool, String> {
    Ok(state.snap.lock().unwrap().snapped)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyT) {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        } else if shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyM) {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("toggle-mode", ());
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(TrayState(Mutex::new(None)))
        .manage(AppState {
            snap: Mutex::new(SnapState {
                snapped: false,
                direction: None,
                restore_position: None,
            }),
            autostart_enabled: Mutex::new(false),
        })
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            let toggle_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyT);
            let mode_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyM);
            app.global_shortcut().register(toggle_shortcut)?;
            app.global_shortcut().register(mode_shortcut)?;

            let autostart_manager = app.autolaunch();
            let initial_autostart = autostart_manager.is_enabled().unwrap_or(false);
            *app.state::<AppState>().autostart_enabled.lock().unwrap() = initial_autostart;

            let show_hide = MenuItem::with_id(app, "toggle", "显示/隐藏窗口", true, None::<&str>)?;
            let mode_full = MenuItem::with_id(app, "mode-full", "完整模式", true, None::<&str>)?;
            let mode_mini = MenuItem::with_id(app, "mode-mini", "精简模式", true, None::<&str>)?;
            let separator1 = PredefinedMenuItem::separator(app)?;
            let task_5min = MenuItem::with_id(app, "task-5min", "5分钟 外包跟进", true, None::<&str>)?;
            let task_10min = MenuItem::with_id(app, "task-10min", "10分钟 Agent跟进", true, None::<&str>)?;
            let task_30min = MenuItem::with_id(app, "task-30min", "30分钟 主任务跟进", true, None::<&str>)?;
            let task_40min = MenuItem::with_id(app, "task-40min", "40分钟 间隔喝水", true, None::<&str>)?;
            let separator2 = PredefinedMenuItem::separator(app)?;
            let autostart_item = MenuItem::with_id(app, "autostart", "开机自启", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show_hide,
                    &mode_full,
                    &mode_mini,
                    &separator1,
                    &task_5min,
                    &task_10min,
                    &task_30min,
                    &task_40min,
                    &separator2,
                    &autostart_item,
                    &quit,
                ],
            )?;

            let tray_icon_bytes = include_bytes!("../icons/icon.png");
            let tray_icon_result = tauri::image::Image::from_bytes(tray_icon_bytes);

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("MMY-TaskTime")
                .menu(&menu)
                .show_menu_on_left_click(false);

            if let Ok(icon) = tray_icon_result {
                tray_builder = tray_builder.icon(icon);
            }

            let tray = tray_builder
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "mode-full" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("switch-mode", "full");
                        }
                    }
                    "mode-mini" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("switch-mode", "mini");
                        }
                    }
                    "task-5min" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("start-task", serde_json::json!({
                                "id": "q5"
                            }));
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "task-10min" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("start-task", serde_json::json!({
                                "id": "q10"
                            }));
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "task-30min" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("start-task", serde_json::json!({
                                "id": "q30"
                            }));
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "task-40min" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("start-task", serde_json::json!({
                                "id": "q40"
                            }));
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "autostart" => {
                        let autostart_manager = app.autolaunch();
                        let state = app.state::<AppState>();
                        let mut is_enabled = state.autostart_enabled.lock().unwrap();
                        *is_enabled = !*is_enabled;
                        if *is_enabled {
                            let _ = autostart_manager.enable();
                        } else {
                            let _ = autostart_manager.disable();
                        }
                        let enabled_val = *is_enabled;
                        drop(is_enabled);
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("autostart-changed", enabled_val);
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            *app.state::<TrayState>().0.lock().unwrap() = Some(tray);

            let window_clone = window.clone();
            window.on_window_event(move |event| match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window_clone.hide();
                }
                _ => {}
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_always_on_top,
            set_window_size,
            get_window_size,
            set_window_resizable,
            set_window_position,
            get_window_position,
            hide_window,
            show_window,
            toggle_window,
            set_skip_taskbar,
            enable_autostart,
            disable_autostart,
            is_autostart_enabled,
            quit_app,
            set_tray_tooltip,
            snap_check,
            snap_show,
            snap_hide,
            edge_unsnap,
            is_snapped
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
