// main.rs
// Tauri アプリケーションのエントリポイント

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{Manager, State};           // Manager で path() を呼ぶ

mod db;

use crate::db::{Db, init_tendency_table, add_tendency, list_tendencies, update_tendency, delete_tendency, init_user_table, add_user, list_users, get_user, update_user, delete_user, init_question_answer_tables, add_question, list_questions, get_questions, add_answer, list_answers, get_answers, update_answer, delete_answer, delete_question, update_question, add_problem_set, list_problem_sets, get_problem_set, update_problem_set, init_result_set_table, init_result_rules_table, init_result_contents_table, init_threshold_conditions_table, add_result_set, list_result_sets, get_result_set, update_result_set, get_result_rule, save_result_rule, list_result_contents, save_result_contents, init_response_tables, create_response_session, add_response_detail, get_user_response_history, list_response_sessions, get_response_details, get_problem_sets_with_results, save_user_responses, get_user_responses, get_latest_session_id, get_session_responses, calculate_user_result, get_max_scores_by_tendency};
fn db_path(app: &tauri::AppHandle) -> PathBuf {
    // OS 推奨フォルダが取れなければカレントに作る
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap())
        .join("chihiro.db")
}

// ----------------- エントリポイント -----------------
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // DB 初期化
            let path = db_path(&app.handle());
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            let first = !path.exists();
            let conn = Connection::open(&path)?;
            if first {
                conn.execute(
                    r#"CREATE TABLE IF NOT EXISTS items (
                        id          INTEGER PRIMARY KEY AUTOINCREMENT,
                        name        TEXT NOT NULL,
                        created_at  TEXT NOT NULL
                    )"#,
                    [],
                )?;
                
                // problem_sets テーブル作成 (result_set_id含む)
                conn.execute(
                    r#"CREATE TABLE IF NOT EXISTS problem_sets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        description TEXT,
                        result_set_id INTEGER,
                        created_at TEXT NOT NULL,
                        FOREIGN KEY (result_set_id) REFERENCES result_sets(id) ON DELETE SET NULL
                    )"#,
                    [],
                )?;
                
                // tendencyマスターも初期化
                init_tendency_table(&conn)?;
                init_user_table(&conn)?;          // ★ユーザーテーブル追加
                init_question_answer_tables(&conn)?;
                init_result_set_table(&conn)?;    // ★結果セット追加
                init_result_rules_table(&conn)?;  // ★結果ルール追加
                init_result_contents_table(&conn)?; // ★結果コンテンツ追加
                init_threshold_conditions_table(&conn)?; // ★しきい値条件追加
                init_response_tables(&conn)?;     // ★回答データ追加
            }
            
            // problem_sets テーブル作成（常時実行）
            conn.execute(
                r#"CREATE TABLE IF NOT EXISTS problem_sets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    result_set_id INTEGER,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (result_set_id) REFERENCES result_sets(id) ON DELETE SET NULL
                )"#,
                [],
            )?;
            
            init_tendency_table(&conn)?;
            init_user_table(&conn)?;          // ★ユーザーテーブル追加
            init_question_answer_tables(&conn)?;
            init_result_set_table(&conn)?;    // ★結果セット追加
            init_result_rules_table(&conn)?;  // ★結果ルール追加
            init_result_contents_table(&conn)?; // ★結果コンテンツ追加
            init_threshold_conditions_table(&conn)?; // ★しきい値条件追加
            init_response_tables(&conn)?;     // ★回答データ追加



            app.manage(Db(std::sync::Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![add_tendency, list_tendencies, update_tendency, delete_tendency, add_user, list_users, get_user, update_user, delete_user, add_question, list_questions, get_questions, add_answer, list_answers, get_answers, delete_answer, update_answer, delete_question, update_question,add_problem_set, list_problem_sets, get_problem_set, update_problem_set, add_result_set, list_result_sets, get_result_set, update_result_set, get_result_rule, save_result_rule, list_result_contents, save_result_contents, create_response_session, add_response_detail, get_user_response_history, list_response_sessions, get_response_details, get_problem_sets_with_results, save_user_responses, get_user_responses, get_latest_session_id, get_session_responses, calculate_user_result, get_max_scores_by_tendency])
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}
