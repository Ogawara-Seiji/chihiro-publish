// lib.rs

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod db;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            // 傾向関連
            db::list_tendencies,
            db::add_tendency,
            db::update_tendency,
            db::delete_tendency,
            // 問題セット関連
            db::list_problem_sets,
            db::add_problem_set,
            db::get_problem_set,
            db::update_problem_set,
            db::get_problem_sets_with_results,
            // 質問関連
            db::get_questions,
            // 回答関連
            db::get_answers,
            db::list_answers,
            db::list_answers,
            db::list_answers,
            // ユーザー関連
            db::list_users,
            db::add_user,
            db::get_user,
            db::update_user,
            db::delete_user,
            // ユーザー回答関連
            db::save_user_responses,
            db::get_user_responses,
            db::get_user_responses_by_date_range,
            db::get_user_response_dates,
            db::get_latest_session_id,
            db::get_session_responses,
            // 回答セッション関連
            db::get_user_response_history,
            db::list_response_sessions,
            // 結果セット関連
            db::list_result_sets,
            db::add_result_set,
            db::get_result_set,
            db::update_result_set,
            // 結果ルール関連
            db::get_result_rule,
            db::save_result_rule,
            // 結果コンテンツ関連
            db::list_result_contents,
            db::save_result_contents,
            // 結果計算関連
            db::calculate_user_result
        ])
        .setup(|app| {
            // データベース接続を状態として管理
            let db_path = app.path().app_data_dir()
                .expect("failed to get app data dir")
                .join("chihiro.db");
            
            // ディレクトリを作成（存在しない場合）
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).expect("failed to create app data dir");
            }
            
            let connection = rusqlite::Connection::open(&db_path)
                .expect("failed to open database");
            
            // データベース初期化（この接続で実行）
            if let Err(e) = db::initialize_database_tables(&connection) {
                eprintln!("データベース初期化エラー: {}", e);
            } else {
                println!("データベーステーブル初期化完了");
            }
            
            let db = db::Db(std::sync::Mutex::new(connection));
            app.manage(db);
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
