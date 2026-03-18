// db.rs
// Tauri アプリケーションのデータベース操作を行うモジュール
// SQLite を使用し、質問と回答の管理を行う

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

// データベースファイルパス（app_data_dirを使用）
fn get_db_path() -> Result<std::path::PathBuf, String> {
    // 注意: この関数は単独では動作しません
    // 実際のパスはlib.rsのsetupで設定されます
    Ok(std::path::PathBuf::from("chihiro.db"))
}

// データベース接続取得（使用しない - 状態管理の接続を使用）
fn get_connection() -> Result<Connection, String> {
    Err("get_connection()は使用されません。状態管理されたDB接続を使用してください。".to_string())
}

/* ------------------ 共通 ------------------ */
#[derive(Serialize)]
pub struct Item {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

/* ------------------ 傾向マスター ------------------ */
#[derive(Serialize, Debug)]
pub struct Tendency {
    pub id: i64,
    pub name: String,
    pub description: String,
}

#[tauri::command]
pub fn add_tendency(
    state: tauri::State<'_, Db>,
    name: String,
    description: String,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO tendency (name, description) VALUES (?1, ?2)",
        params![name, description],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_tendencies(state: tauri::State<'_, Db>) -> Result<Vec<Tendency>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, description FROM tendency ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Tendency {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_tendency(
    state: tauri::State<'_, Db>,
    id: i64,
    name: String,
    description: String,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE tendency SET name = ?1, description = ?2 WHERE id = ?3",
        params![name, description, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_tendency(state: tauri::State<'_, Db>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM tendency WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn init_tendency_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        r#"CREATE TABLE IF NOT EXISTS tendency (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            description TEXT NOT NULL
        )"#,
        [],
    )?;
    Ok(())
}

/* ------------------ ユーザーマスター ------------------ */
#[derive(Serialize, Debug)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub gender: String,
    pub birth_date: String,
    pub notes: String,
    pub created_at: String,
}

pub fn init_user_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        r#"CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            gender      TEXT NOT NULL,
            birth_date  TEXT NOT NULL,
            notes       TEXT NOT NULL DEFAULT '',
            created_at  TEXT NOT NULL
        )"#,
        [],
    )?;
    Ok(())
}

#[tauri::command]
pub fn add_user(
    state: tauri::State<'_, Db>,
    name: String,
    gender: String,
    birth_date: String,
    notes: String,
) -> Result<i64, String> {
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO users (name, gender, birth_date, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![name, gender, birth_date, notes, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn list_users(state: tauri::State<'_, Db>) -> Result<Vec<User>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, gender, birth_date, notes, created_at FROM users ORDER BY id DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                name: row.get(1)?,
                gender: row.get(2)?,
                birth_date: row.get(3)?,
                notes: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_user(state: tauri::State<'_, Db>, id: i64) -> Result<User, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, gender, birth_date, notes, created_at FROM users WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    
    let user = stmt
        .query_row(params![id], |row| {
            Ok(User {
                id: row.get(0)?,
                name: row.get(1)?,
                gender: row.get(2)?,
                birth_date: row.get(3)?,
                notes: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    
    Ok(user)
}

#[tauri::command]
pub fn update_user(
    state: tauri::State<'_, Db>,
    id: i64,
    name: String,
    gender: String,
    birth_date: String,
    notes: String,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE users SET name = ?1, gender = ?2, birth_date = ?3, notes = ?4 WHERE id = ?5",
        params![name, gender, birth_date, notes, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_user(state: tauri::State<'_, Db>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM users WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/* ------------------ 問題セット ------------------ */
#[derive(Serialize, Debug)]
pub struct ProblemSet {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub result_set_id: Option<i64>, // 関連付けられた結果セットID
    pub created_at: String,
}

// pub fn init_problem_set_table(conn: &Connection) -> rusqlite::Result<()> {
//     conn.execute(
//         r#"CREATE TABLE IF NOT EXISTS problem_sets(
//             id          INTEGER PRIMARY KEY AUTOINCREMENT,
//             name        TEXT NOT NULL,
//             description TEXT,
//             result_set_id INTEGER,
//             created_at  TEXT NOT NULL,
//             FOREIGN KEY (result_set_id) REFERENCES result_sets (id)
//         )"#,
//         [],
//     )?;
//     Ok(())
// }

#[tauri::command]
pub fn add_problem_set(
    state: tauri::State<'_, Db>,
    name: String,
    description: String,
    result_set_id: Option<i64>,
) -> Result<i64, String> {
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO problem_sets (name, description, result_set_id, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![name, description, result_set_id, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn list_problem_sets(state: tauri::State<'_, Db>) -> Result<Vec<ProblemSet>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, description, result_set_id, created_at FROM problem_sets ORDER BY id DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ProblemSet {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                result_set_id: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_problem_set(state: tauri::State<'_, Db>, id: i64) -> Result<ProblemSet, String> {
    println!("get_problem_set called with id: {}", id);
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, description, result_set_id, created_at FROM problem_sets WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    
    let problem_set = stmt
        .query_row(params![id], |row| {
            Ok(ProblemSet {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                result_set_id: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    
    println!("get_problem_set result: {:?}", problem_set);
    Ok(problem_set)
}

#[tauri::command]
pub fn update_problem_set(
    state: tauri::State<'_, Db>,
    id: i64,
    name: String,
    description: String,
    result_set_id: Option<i64>,
) -> Result<(), String> {
    println!("update_problem_set called with: id={}, name={}, description={}, result_set_id={:?}", id, name, description, result_set_id);
    let conn = state.0.lock().unwrap();
    let result = conn.execute(
        "UPDATE problem_sets SET name = ?1, description = ?2, result_set_id = ?3 WHERE id = ?4",
        params![name, description, result_set_id, id],
    );
    match result {
        Ok(rows_affected) => {
            println!("update_problem_set success: {} rows affected", rows_affected);
            Ok(())
        },
        Err(e) => {
            println!("update_problem_set error: {}", e);
            Err(e.to_string())
        }
    }
}

/* ------------------ 結果マスター ------------------ */
#[derive(Serialize, Debug)]
pub struct ResultSet {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub title: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Debug, serde::Deserialize)]
pub struct ResultRule {
    pub id: Option<i64>,
    pub set_id: i64,
    pub condition_type: String, // "threshold" or "top_display"
    pub display_count: Option<i32>, // 上位表示条件用
}

#[derive(Serialize, Debug, serde::Deserialize)]
pub struct ThresholdCondition {
    pub id: Option<i64>,
    pub content_id: Option<i64>,
    pub condition_index: i32,
    pub tendency_id: i32,
    pub threshold_score: i32,
}

#[derive(Serialize, Debug, serde::Deserialize)]
pub struct ResultContent {
    pub id: Option<i64>,
    pub set_id: i64,
    pub content_index: i32,
    pub content: String, // 結果内容（説明とアドバイスを統合）
    pub conditions: Vec<ThresholdCondition>, // しきい値条件リスト
    pub logic_operator: String, // "and" or "or" - この結果内容内での条件結合
    pub tendency_id: Option<i64>, // 上位表示条件の時に使用する傾向ID
}

pub fn init_result_set_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        r#"CREATE TABLE IF NOT EXISTS result_sets(
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            description TEXT,
            title       TEXT,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        )"#,
        [],
    )?;
    Ok(())
}

pub fn init_result_rules_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        r#"CREATE TABLE IF NOT EXISTS result_rules(
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            set_id          INTEGER NOT NULL UNIQUE,
            condition_type  TEXT NOT NULL CHECK (condition_type IN ('threshold', 'top_display')),
            display_count   INTEGER,
            logic_operator  TEXT CHECK (logic_operator IN ('and', 'or')),
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            FOREIGN KEY (set_id) REFERENCES result_sets (id) ON DELETE CASCADE
        )"#,
        [],
    )?;
    Ok(())
}

pub fn init_result_contents_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        r#"CREATE TABLE IF NOT EXISTS result_contents(
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            set_id          INTEGER NOT NULL,
            content_index   INTEGER NOT NULL,
            content         TEXT NOT NULL,
            condition_logic TEXT CHECK (condition_logic IN ('and', 'or')),
            tendency_id     INTEGER,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            FOREIGN KEY (set_id) REFERENCES result_sets (id) ON DELETE CASCADE,
            FOREIGN KEY (tendency_id) REFERENCES tendency (id) ON DELETE SET NULL
        )"#,
        [],
    )?;
    
    // マイグレーション: tendency_id カラムが存在しない場合は追加
    let mut has_tendency_id = false;
    let mut stmt = conn.prepare("PRAGMA table_info(result_contents)")?;
    let rows = stmt.query_map([], |row| {
        let column_name: String = row.get(1)?;
        Ok(column_name)
    })?;
    
    for row in rows {
        if let Ok(column_name) = row {
            if column_name == "tendency_id" {
                has_tendency_id = true;
                break;
            }
        }
    }
    
    if !has_tendency_id {
        conn.execute(
            "ALTER TABLE result_contents ADD COLUMN tendency_id INTEGER REFERENCES tendency(id) ON DELETE SET NULL",
            [],
        )?;
    }
    
    Ok(())
}

pub fn init_threshold_conditions_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        r#"CREATE TABLE IF NOT EXISTS threshold_conditions(
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            content_id      INTEGER NOT NULL,
            tendency_id     INTEGER NOT NULL,
            threshold_score INTEGER NOT NULL,
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL,
            FOREIGN KEY (content_id) REFERENCES result_contents (id) ON DELETE CASCADE,
            FOREIGN KEY (tendency_id) REFERENCES tendency (id)
        )"#,
        [],
    )?;
    Ok(())
}

#[tauri::command]
pub fn add_result_set(
    state: tauri::State<'_, Db>,
    name: String,
    description: String,
) -> Result<i64, String> {
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO result_sets (name, description, title, created_at, updated_at)
         VALUES (?1, ?2, '', ?3, ?4)",
        params![name, description, now, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn list_result_sets(state: tauri::State<'_, Db>) -> Result<Vec<ResultSet>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, description, title, created_at FROM result_sets ORDER BY id DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ResultSet {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                title: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_result_set(state: tauri::State<'_, Db>, id: i64) -> Result<ResultSet, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, description, title, created_at FROM result_sets WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    
    let result_set = stmt
        .query_row(params![id], |row| {
            Ok(ResultSet {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                title: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    
    Ok(result_set)
}

#[tauri::command]
pub fn update_result_set(
    state: tauri::State<'_, Db>,
    id: i64,
    name: String,
    description: String,
    title: String,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE result_sets SET name = ?1, description = ?2, title = ?3, updated_at = ?4 WHERE id = ?5",
        params![name, description, title, now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_result_rule(state: tauri::State<'_, Db>, set_id: i64) -> Result<Option<ResultRule>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, set_id, condition_type, display_count 
                 FROM result_rules WHERE set_id = ?1")
        .map_err(|e| e.to_string())?;
    
    let rule = stmt
        .query_row(params![set_id], |row| {
            Ok(ResultRule {
                id: Some(row.get(0)?),
                set_id: row.get(1)?,
                condition_type: row.get(2)?,
                display_count: row.get(3)?,
            })
        });
    
    match rule {
        Ok(rule) => Ok(Some(rule)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn list_result_contents(state: tauri::State<'_, Db>, set_id: i64) -> Result<Vec<ResultContent>, String> {
    let conn = state.0.lock().unwrap();
    
    // 結果内容を取得
    let mut stmt = conn
        .prepare("SELECT id, set_id, content_index, content, condition_logic, tendency_id 
                 FROM result_contents WHERE set_id = ?1 ORDER BY content_index ASC")
        .map_err(|e| e.to_string())?;
    
    let rows = stmt
        .query_map(params![set_id], |row| {
            Ok(ResultContent {
                id: Some(row.get(0)?),
                set_id: row.get(1)?,
                content_index: row.get(2)?,
                content: row.get(3)?,
                logic_operator: row.get::<_, Option<String>>(4)?.unwrap_or_else(|| "and".to_string()),
                tendency_id: row.get(5)?,
                conditions: Vec::new(), // 後で設定
            })
        })
        .map_err(|e| e.to_string())?;
    
    let mut contents: Vec<ResultContent> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    
    // 各結果内容のしきい値条件を取得
    for content in &mut contents {
        if let Some(content_id) = content.id {
            let mut threshold_stmt = conn
                .prepare("SELECT id, content_id, tendency_id, threshold_score 
                         FROM threshold_conditions WHERE content_id = ?1 ORDER BY id ASC")
                .map_err(|e| e.to_string())?;
            
            let threshold_rows = threshold_stmt
                .query_map(params![content_id], |row| {
                    Ok(ThresholdCondition {
                        id: Some(row.get(0)?),
                        content_id: Some(row.get(1)?),
                        condition_index: 0, // 後で設定
                        tendency_id: row.get(2)?,
                        threshold_score: row.get(3)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            
            let mut threshold_conditions: Vec<ThresholdCondition> = threshold_rows
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            
            // condition_indexを設定
            for (index, condition) in threshold_conditions.iter_mut().enumerate() {
                condition.condition_index = index as i32;
            }
            
            content.conditions = threshold_conditions;
        }
    }
    
    Ok(contents)
}

#[tauri::command]
pub fn save_result_rule(
    state: tauri::State<'_, Db>,
    set_id: i64,
    rule: ResultRule,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    
    // 既存のルールがあるかチェック
    let exists = conn
        .prepare("SELECT 1 FROM result_rules WHERE set_id = ?1")
        .and_then(|mut stmt| stmt.exists(params![set_id]))
        .map_err(|e| e.to_string())?;
    
    if exists {
        // 更新
        conn.execute(
            "UPDATE result_rules SET condition_type = ?1, display_count = ?2, updated_at = ?3
             WHERE set_id = ?4",
            params![
                rule.condition_type,
                rule.display_count,
                now,
                set_id
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        // 挿入
        conn.execute(
            "INSERT INTO result_rules (set_id, condition_type, display_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                set_id,
                rule.condition_type,
                rule.display_count,
                now,
                now
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn save_result_contents(
    state: tauri::State<'_, Db>,
    set_id: i64,
    contents: Vec<ResultContent>,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    
    // トランザクション開始
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    
    // 既存のコンテンツと関連するしきい値条件を削除
    tx.execute(
        "DELETE FROM threshold_conditions WHERE content_id IN (SELECT id FROM result_contents WHERE set_id = ?1)",
        params![set_id],
    )
    .map_err(|e| e.to_string())?;
    
    tx.execute(
        "DELETE FROM result_contents WHERE set_id = ?1",
        params![set_id],
    )
    .map_err(|e| e.to_string())?;
    
    // 新しいコンテンツを挿入
    for content in contents {
        // 結果内容を挿入
        tx.execute(
            "INSERT INTO result_contents (set_id, content_index, content, condition_logic, tendency_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                set_id,
                content.content_index,
                content.content,
                content.logic_operator,
                content.tendency_id,
                now,
                now
            ],
        )
        .map_err(|e| e.to_string())?;
        
        let content_id = tx.last_insert_rowid();
        
        // しきい値条件を挿入
        for threshold_condition in content.conditions {
            tx.execute(
                "INSERT INTO threshold_conditions (content_id, tendency_id, threshold_score, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    content_id,
                    threshold_condition.tendency_id,
                    threshold_condition.threshold_score,
                    now,
                    now
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    
    // コミット
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/* ------------------ 質問マスター ------------------ */
#[derive(Serialize, Debug)]
pub struct Question {
    pub id: i64,
    pub text: String,
    pub created_at: String,
}

#[tauri::command]
pub fn add_question(
    state: tauri::State<'_, Db>,
    problem_set_id: i64,
    text: String,
) -> Result<i64, String> {
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO questions (problem_set_id, text, created_at)
         VALUES (?1, ?2, ?3)",
        params![problem_set_id, text, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn list_questions(
    state: tauri::State<'_, Db>,
    problem_set_id: i64,
) -> Result<Vec<Question>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, text, created_at
             FROM questions
             WHERE problem_set_id = ?1
             ORDER BY id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![problem_set_id], |row| {
            Ok(Question {
                id: row.get(0)?,
                text: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_questions(
    state: tauri::State<'_, Db>,
    problem_set_id: i64,
) -> Result<Vec<Question>, String> {
    list_questions(state, problem_set_id)
}

/* ------------------ 回答マスター ------------------ */
#[derive(Serialize, Debug)]
pub struct Answer {
    pub id: i64,
    pub question_id: i64,
    pub answer_index: i64,
    pub text: String,
    pub tendency_id: i64,
    pub weight: i64,
}

#[tauri::command]
pub fn add_answer(
    state: tauri::State<'_, Db>,
    question_id: i64,
    answer_index: i64,
    text: String,
    tendency_id: i64,
    weight: i64,
) -> Result<(), String> {
    if !(1..=10).contains(&answer_index) {
        return Err("answer_index は 1〜10 にしてください".into());
    }
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO answers (question_id, answer_index, text, tendency_id, weight)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![question_id, answer_index, text, tendency_id, weight],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_answers(
    state: tauri::State<'_, Db>,
    question_id: i64,
) -> Result<Vec<Answer>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, question_id, answer_index, text, tendency_id, weight
         FROM answers
         WHERE question_id = ?1
         ORDER BY answer_index",
    ).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![question_id], |row| {
            Ok(Answer {
                id: row.get(0)?,
                question_id: row.get(1)?,
                answer_index: row.get(2)?,
                text: row.get(3)?,
                tendency_id: row.get(4)?,
                weight: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_answers(
    state: tauri::State<'_, Db>,
    problem_set_id: i64,
) -> Result<Vec<Answer>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT a.id, a.question_id, a.answer_index, a.text, a.tendency_id, a.weight
         FROM answers a
         INNER JOIN questions q ON a.question_id = q.id
         WHERE q.problem_set_id = ?1
         ORDER BY q.id, a.answer_index"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(
        params![problem_set_id],
        |row| {
            Ok(Answer {
                id: row.get(0)?,
                question_id: row.get(1)?,
                answer_index: row.get(2)?,
                text: row.get(3)?,
                tendency_id: row.get(4)?,
                weight: row.get(5)?,
            })
        }
    ).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_answer(
    state: tauri::State<'_, Db>,
    id: i64,
    answer_index: i64,
    text: String,
    tendency_id: i64,
    weight: i64,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE answers
         SET answer_index = ?1, text = ?2, tendency_id = ?3, weight = ?4
         WHERE id = ?5",
        params![answer_index, text, tendency_id, weight, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_answer(state: tauri::State<'_, Db>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM answers WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/* ------------------ テーブル初期化 ------------------ */
pub fn init_question_answer_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        r#"CREATE TABLE IF NOT EXISTS questions(
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_set_id  INTEGER NOT NULL,
            text            TEXT NOT NULL,
            created_at      TEXT NOT NULL,
            FOREIGN KEY(problem_set_id) REFERENCES problem_sets(id) ON DELETE CASCADE
        )"#,
        [],
    )?;
    conn.execute(
        r#"CREATE TABLE IF NOT EXISTS answers(
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id   INTEGER NOT NULL,
            answer_index  INTEGER NOT NULL CHECK(answer_index BETWEEN 1 AND 10),
            text          TEXT NOT NULL,
            tendency_id   INTEGER NOT NULL DEFAULT 1,
            weight        INTEGER NOT NULL DEFAULT 1,
            UNIQUE(question_id, answer_index),
            FOREIGN KEY(question_id)  REFERENCES questions(id)  ON DELETE CASCADE,
            FOREIGN KEY(tendency_id)  REFERENCES tendency(id)   ON DELETE RESTRICT
        )"#,
        [],
    )?;
    Ok(())
}

/* ------------------ Question 更新 / 削除 ------------------ */
#[tauri::command]
pub fn update_question(
    state: tauri::State<'_, Db>,
    id: i64,
    text: String,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE questions SET text = ?1 WHERE id = ?2",
        params![text, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_question(state: tauri::State<'_, Db>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM questions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/* ------------------ QA 一括登録（セット対応） ------------------ */
#[tauri::command]
pub fn add_qa_set(
    state: tauri::State<'_, Db>,
    problem_set_id: i64,      // ★必須
    question_text: String,
    answers: Vec<String>,     // text だけ受け取り → tendency/weight はデフォルト 1
) -> Result<(), String> {
    if answers.is_empty() {
        return Err("answers が空です".into());
    }

    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 質問
    tx.execute(
        "INSERT INTO questions (problem_set_id, text, created_at)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
        params![problem_set_id, question_text],
    )
    .map_err(|e| e.to_string())?;
    let qid = tx.last_insert_rowid();

    // 回答
    for (idx, text) in answers.into_iter().enumerate() {
        let idx_i64 = (idx + 1) as i64;
        tx.execute(
            "INSERT INTO answers (question_id, answer_index, text)
             VALUES (?1, ?2, ?3)",
            params![qid, idx_i64, text],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/* ------------------ 回答データ ------------------ */
#[derive(Serialize, Debug)]
pub struct ResponseSession {
    pub id: i64,
    pub user_id: i64,
    pub user_name: String,
    pub problem_set_id: i64,
    pub problem_set_name: String,
    pub response_date: String,
    pub created_at: String,
}

#[derive(Serialize, Debug)]
pub struct ResponseDetail {
    pub id: i64,
    pub session_id: i64,
    pub question_id: i64,
    pub answer_id: i64,
    pub tendency_id: i64,
    pub tendency_name: String,
    pub score: i32,
}

pub fn init_response_tables(conn: &Connection) -> rusqlite::Result<()> {
    // 回答セッションテーブル
    conn.execute(
        "CREATE TABLE IF NOT EXISTS response_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            problem_set_id INTEGER NOT NULL,
            response_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(problem_set_id) REFERENCES problem_sets(id)
        )",
        [],
    )?;

    // 回答詳細テーブル
    conn.execute(
        "CREATE TABLE IF NOT EXISTS response_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            answer_id INTEGER NOT NULL,
            tendency_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            FOREIGN KEY(session_id) REFERENCES response_sessions(id),
            FOREIGN KEY(question_id) REFERENCES questions(id),
            FOREIGN KEY(answer_id) REFERENCES answers(id),
            FOREIGN KEY(tendency_id) REFERENCES tendency(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            problem_set_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            answer_id INTEGER NOT NULL,
            score INTEGER DEFAULT 0,
            tendency_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (problem_set_id) REFERENCES problem_sets(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
            FOREIGN KEY (tendency_id) REFERENCES tendency(id) ON DELETE SET NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE CASCADE
        )",
        [],
    )?;
    Ok(())
}

#[tauri::command]
pub fn create_response_session(
    state: tauri::State<'_, Db>,
    user_id: i64,
    problem_set_id: i64,
    response_date: String,
) -> Result<i64, String> {
    let conn = state.0.lock().unwrap();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO response_sessions (user_id, problem_set_id, response_date, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![user_id, problem_set_id, response_date, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn add_response_detail(
    state: tauri::State<'_, Db>,
    session_id: i64,
    question_id: i64,
    answer_id: i64,
    tendency_id: i64,
    score: i32,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO response_details (session_id, question_id, answer_id, tendency_id, score)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![session_id, question_id, answer_id, tendency_id, score],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_user_response_history(
    state: tauri::State<'_, Db>,
    user_id: i64,
    problem_set_id: i64,
) -> Result<Vec<ResponseSession>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT rs.id, rs.user_id, u.name, rs.problem_set_id, ps.name, rs.response_date, rs.created_at
             FROM response_sessions rs
             JOIN users u ON rs.user_id = u.id
             JOIN problem_sets ps ON rs.problem_set_id = ps.id
             WHERE rs.user_id = ?1 AND rs.problem_set_id = ?2
             ORDER BY rs.response_date DESC"
        )
        .map_err(|e| e.to_string())?;
    
    let rows = stmt
        .query_map(params![user_id, problem_set_id], |row| {
            Ok(ResponseSession {
                id: row.get(0)?,
                user_id: row.get(1)?,
                user_name: row.get(2)?,
                problem_set_id: row.get(3)?,
                problem_set_name: row.get(4)?,
                response_date: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_response_sessions(state: tauri::State<'_, Db>) -> Result<Vec<ResponseSession>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT rs.id, rs.user_id, u.name, rs.problem_set_id, ps.name, rs.response_date, rs.created_at
             FROM response_sessions rs
             JOIN users u ON rs.user_id = u.id
             JOIN problem_sets ps ON rs.problem_set_id = ps.id
             ORDER BY rs.created_at DESC"
        )
        .map_err(|e| e.to_string())?;
    
    let rows = stmt
        .query_map([], |row| {
            Ok(ResponseSession {
                id: row.get(0)?,
                user_id: row.get(1)?,
                user_name: row.get(2)?,
                problem_set_id: row.get(3)?,
                problem_set_name: row.get(4)?,
                response_date: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_response_details(
    state: tauri::State<'_, Db>,
    session_id: i64,
) -> Result<Vec<ResponseDetail>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT rd.id, rd.session_id, rd.question_id, rd.answer_id, rd.tendency_id, t.name, rd.score
             FROM response_details rd
             JOIN tendency t ON rd.tendency_id = t.id
             WHERE rd.session_id = ?1"
        )
        .map_err(|e| e.to_string())?;
    
    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(ResponseDetail {
                id: row.get(0)?,
                session_id: row.get(1)?,
                question_id: row.get(2)?,
                answer_id: row.get(3)?,
                tendency_id: row.get(4)?,
                tendency_name: row.get(5)?,
                score: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_problem_sets_with_results(state: tauri::State<'_, Db>) -> Result<Vec<ProblemSet>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, description, result_set_id, created_at FROM problem_sets WHERE result_set_id IS NOT NULL ORDER BY id DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ProblemSet {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                result_set_id: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/* ------------------ ユーザー回答 ------------------ */
#[derive(Serialize, Debug)]
pub struct UserResponse {
    pub id: i64,
    pub user_id: i64,
    pub problem_set_id: i64,
    pub question_id: i64,
    pub answer_id: i64,
    pub score: i64,
    pub tendency_id: Option<i64>,
    pub created_at: String,
}

#[derive(serde::Deserialize, Debug)]
pub struct UserResponseInput {
    pub question_id: i64,
    pub answer_id: i64,
    pub score: Option<i64>,
    pub tendency_id: Option<i64>,
}

#[tauri::command]
pub fn save_user_responses(
    state: tauri::State<'_, Db>,
    user_id: i64,
    problem_set_id: i64,
    responses: Vec<UserResponseInput>,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    
    // トランザクション開始
    let transaction = conn.unchecked_transaction()
        .map_err(|e| format!("トランザクション開始エラー: {}", e))?;

    // 回答セッションを作成
    let now = Utc::now().to_rfc3339();
    let response_date = Utc::now().format("%Y%m%d").to_string(); // YYYYMMDD形式
    
    transaction.execute(
        "INSERT INTO response_sessions (user_id, problem_set_id, response_date, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![user_id, problem_set_id, response_date, now],
    ).map_err(|e| format!("回答セッション作成エラー: {}", e))?;
    
    let session_id = transaction.last_insert_rowid();

    // 各回答を新規追加（session_idと関連付け）
    for response in responses {
        transaction.execute(
            "INSERT INTO user_responses (user_id, problem_set_id, question_id, answer_id, score, tendency_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                user_id, 
                problem_set_id, 
                response.question_id, 
                response.answer_id, 
                response.score.unwrap_or(0),
                response.tendency_id
            ],
        ).map_err(|e| format!("回答保存エラー: {}", e))?;
        
        // response_detailsにも保存（回答セッションとの関連付け用）
        transaction.execute(
            "INSERT INTO response_details (session_id, question_id, answer_id, tendency_id, score)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                session_id,
                response.question_id, 
                response.answer_id, 
                response.tendency_id.unwrap_or(1),
                response.score.unwrap_or(0)
            ],
        ).map_err(|e| format!("回答詳細保存エラー: {}", e))?;
    }

    // コミット
    transaction.commit()
        .map_err(|e| format!("トランザクションコミットエラー: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_user_responses(
    state: tauri::State<'_, Db>,
    user_id: i64,
    problem_set_id: i64,
) -> Result<Vec<UserResponse>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, user_id, problem_set_id, question_id, answer_id, score, tendency_id, created_at
         FROM user_responses 
         WHERE user_id = ?1 AND problem_set_id = ?2
         ORDER BY created_at DESC, question_id"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(
        params![user_id, problem_set_id],
        |row| {
            Ok(UserResponse {
                id: row.get(0)?,
                user_id: row.get(1)?,
                problem_set_id: row.get(2)?,
                question_id: row.get(3)?,
                answer_id: row.get(4)?,
                score: row.get(5)?,
                tendency_id: row.get(6)?,
                created_at: row.get(7)?,
            })
        }
    ).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// 最新の回答セッションIDを取得
#[tauri::command]
pub fn get_latest_session_id(
    state: tauri::State<'_, Db>,
    user_id: i64,
    problem_set_id: i64,
) -> Result<i64, String> {
    let conn = state.0.lock().unwrap();
    let session_id = conn
        .query_row(
            "SELECT id FROM response_sessions 
             WHERE user_id = ?1 AND problem_set_id = ?2
             ORDER BY created_at DESC LIMIT 1",
            params![user_id, problem_set_id],
            |row| Ok(row.get(0)?),
        )
        .map_err(|e| format!("最新セッションが見つかりません: {}", e))?;
    
    Ok(session_id)
}

// 特定セッションの回答詳細を取得（response_detailsテーブルから）
#[tauri::command]
pub fn get_session_responses(
    state: tauri::State<'_, Db>,
    session_id: i64,
) -> Result<Vec<UserResponse>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT rd.id, rs.user_id, rs.problem_set_id, rd.question_id, rd.answer_id, rd.score, rd.tendency_id, rs.created_at
         FROM response_details rd
         JOIN response_sessions rs ON rd.session_id = rs.id
         WHERE rd.session_id = ?1
         ORDER BY rd.question_id"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(
        params![session_id],
        |row| {
            Ok(UserResponse {
                id: row.get(0)?,
                user_id: row.get(1)?,
                problem_set_id: row.get(2)?,
                question_id: row.get(3)?,
                answer_id: row.get(4)?,
                score: row.get(5)?,
                tendency_id: row.get(6)?,
                created_at: row.get(7)?,
            })
        }
    ).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// 特定の日付範囲の回答を取得（created_atを使用）
#[tauri::command]
pub fn get_user_responses_by_date_range(
    state: tauri::State<'_, Db>,
    user_id: i64,
    problem_set_id: i64,
    start_date: String, // YYYY-MM-DD format
    end_date: String,   // YYYY-MM-DD format
) -> Result<Vec<UserResponse>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, user_id, problem_set_id, question_id, answer_id, score, tendency_id, created_at
         FROM user_responses 
         WHERE user_id = ?1 AND problem_set_id = ?2 
           AND date(created_at) BETWEEN ?3 AND ?4
         ORDER BY created_at DESC, question_id"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(
        params![user_id, problem_set_id, start_date, end_date],
        |row| {
            Ok(UserResponse {
                id: row.get(0)?,
                user_id: row.get(1)?,
                problem_set_id: row.get(2)?,
                question_id: row.get(3)?,
                answer_id: row.get(4)?,
                score: row.get(5)?,
                tendency_id: row.get(6)?,
                created_at: row.get(7)?,
            })
        }
    ).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ユーザーの回答日一覧を取得（created_atから日付を抽出）
#[tauri::command]
pub fn get_user_response_dates(
    state: tauri::State<'_, Db>,
    user_id: i64,
    problem_set_id: i64,
) -> Result<Vec<String>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT DISTINCT date(created_at) as response_date
         FROM user_responses 
         WHERE user_id = ?1 AND problem_set_id = ?2
         ORDER BY response_date DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(
        params![user_id, problem_set_id],
        |row| {
            Ok(row.get::<_, String>(0)?)
        }
    ).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/* ------------------ データベース初期化 ------------------ */
// 注意: この関数は使用されません。initialize_database_tables()を使用してください。
#[tauri::command]
pub fn initialize_database() -> Result<String, String> {
    return Err("この関数は使用されません。lib.rsのsetupでinitialize_database_tables()が使用されます。".to_string());
}

// データベーステーブル初期化関数（接続を直接受け取る）
pub fn initialize_database_tables(conn: &rusqlite::Connection) -> Result<(), String> {
    // テーブル作成
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tendency (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| format!("tendencyテーブル作成エラー: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS problem_sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            result_set_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (result_set_id) REFERENCES result_sets(id) ON DELETE SET NULL
        )",
        [],
    ).map_err(|e| format!("problem_setsテーブル作成エラー: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS result_sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| format!("result_setsテーブル作成エラー: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS result_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            set_id INTEGER NOT NULL,
            rule_index INTEGER NOT NULL,
            condition_type TEXT NOT NULL CHECK (condition_type IN ('threshold', 'top_tendency')),
            condition_text TEXT NOT NULL,
            description TEXT NOT NULL,
            advice TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (set_id) REFERENCES result_sets (id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("result_rulesテーブル作成エラー: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_set_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            question_type TEXT NOT NULL CHECK (question_type IN ('single', 'multiple', 'text')),
            options TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (problem_set_id) REFERENCES problem_sets(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("questionsテーブル作成エラー: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            answer_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            tendency_id INTEGER NOT NULL,
            weight INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
            FOREIGN KEY (tendency_id) REFERENCES tendency(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("answersテーブル作成エラー: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            problem_set_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            answer INTEGER NOT NULL,
            score INTEGER DEFAULT 0,
            tendency_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (problem_set_id) REFERENCES problem_sets(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
            FOREIGN KEY (tendency_id) REFERENCES tendency(id) ON DELETE SET NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (answer) REFERENCES answers(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("user_responsesテーブル作成エラー: {}", e))?;

    Ok(())
}

#[derive(Serialize, Debug)]
pub struct UserResult {
    pub result_set_id: i64,
    pub result_set_title: Option<String>,
    pub contents: Vec<String>,
}

#[tauri::command]
pub fn calculate_user_result(
    state: tauri::State<'_, Db>,
    user_id: i64,
    problem_set_id: i64,
) -> Result<UserResult, String> {
    let conn = state.0.lock().unwrap();
    
    // 問題セットから結果セットIDを取得
    let mut stmt = conn
        .prepare("SELECT result_set_id FROM problem_sets WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    
    let result_set_id: i64 = stmt
        .query_row(params![problem_set_id], |row| {
            Ok(row.get(0)?)
        })
        .map_err(|e| format!("問題セットが見つかりません: {}", e))?;
    
    // 結果セット情報を取得
    let mut stmt = conn
        .prepare("SELECT title FROM result_sets WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    
    let result_set_title: Option<String> = stmt
        .query_row(params![result_set_id], |row| {
            Ok(row.get(0)?)
        })
        .map_err(|e| format!("結果セットが見つかりません: {}", e))?;
    
    // 最新の回答セッションIDを取得
    let latest_session_id: i64 = conn
        .query_row(
            "SELECT id FROM response_sessions 
             WHERE user_id = ?1 AND problem_set_id = ?2
             ORDER BY created_at DESC LIMIT 1",
            params![user_id, problem_set_id],
            |row| Ok(row.get(0)?),
        )
        .map_err(|e| format!("回答セッションが見つかりません: {}", e))?;
    
    // 結果ルールを取得
    let mut stmt = conn
        .prepare("SELECT condition_type, display_count FROM result_rules WHERE set_id = ?1")
        .map_err(|e| e.to_string())?;
    
    let rule = stmt
        .query_row(params![result_set_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<i32>>(1)?))
        })
        .map_err(|e| format!("結果ルールが見つかりません: {}", e))?;
    
    let (condition_type, display_count) = rule;
    
    if condition_type == "top_display" {
        // 上位表示方式: 傾向スコアの上位を表示
        calculate_top_display_result(&conn, latest_session_id, result_set_id, display_count.unwrap_or(3))
    } else {
        // しきい値方式: 条件を満たすコンテンツを表示
        calculate_threshold_result(&conn, latest_session_id, result_set_id)
    }
    .map(|contents| UserResult {
        result_set_id,
        result_set_title,
        contents,
    })
}

fn calculate_top_display_result(
    conn: &rusqlite::Connection,
    session_id: i64,
    result_set_id: i64,
    display_count: i32,
) -> Result<Vec<String>, String> {
    // セッションの傾向別スコアを計算
    let mut stmt = conn
        .prepare(
            "SELECT rd.tendency_id, SUM(rd.score) as total_score, t.name
             FROM response_details rd
             JOIN tendency t ON rd.tendency_id = t.id
             WHERE rd.session_id = ?1
             GROUP BY rd.tendency_id, t.name
             ORDER BY total_score DESC
             LIMIT ?2"
        )
        .map_err(|e| e.to_string())?;
    
    let top_tendencies: Vec<(i64, String)> = stmt
        .query_map(params![session_id, display_count], |row| {
            Ok((row.get(0)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    // 上位傾向に対応する結果コンテンツを取得
    let mut contents = Vec::new();
    for (tendency_id, _tendency_name) in top_tendencies {
        let mut stmt = conn
            .prepare(
                "SELECT content FROM result_contents 
                 WHERE set_id = ?1 AND tendency_id = ?2
                 ORDER BY content_index"
            )
            .map_err(|e| e.to_string())?;
        
        let tendency_contents: Vec<String> = stmt
            .query_map(params![result_set_id, tendency_id], |row| {
                Ok(row.get(0)?)
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        
        contents.extend(tendency_contents);
    }
    
    Ok(contents)
}

fn calculate_threshold_result(
    conn: &rusqlite::Connection,
    session_id: i64,
    result_set_id: i64,
) -> Result<Vec<String>, String> {
    // 結果コンテンツとその条件を取得
    let mut stmt = conn
        .prepare(
            "SELECT id, content, condition_logic FROM result_contents 
             WHERE set_id = ?1 
             ORDER BY content_index"
        )
        .map_err(|e| e.to_string())?;
    
    let content_rows: Vec<(i64, String, String)> = stmt
        .query_map(params![result_set_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    let mut contents = Vec::new();
    
    for (content_id, content, condition_logic) in content_rows {
        // このコンテンツの条件を取得
        let mut stmt = conn
            .prepare(
                "SELECT tendency_id, threshold_score FROM threshold_conditions 
                 WHERE content_id = ?1"
            )
            .map_err(|e| e.to_string())?;
        
        let conditions: Vec<(i64, i32)> = stmt
            .query_map(params![content_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        
        // セッションでのユーザーのスコアと条件を照合
        let mut condition_results = Vec::new();
        for (tendency_id, threshold) in conditions {
            let user_score: i32 = conn
                .query_row(
                    "SELECT COALESCE(SUM(score), 0) FROM response_details 
                     WHERE session_id = ?1 AND tendency_id = ?2",
                    params![session_id, tendency_id],
                    |row| Ok(row.get(0)?),
                )
                .unwrap_or(0);
            
            condition_results.push(user_score >= threshold);
        }
        
        // 論理演算子に基づいて条件を評価
        let meets_condition = if condition_logic == "and" {
            condition_results.iter().all(|&x| x)
        } else {
            condition_results.iter().any(|&x| x)
        };
        
        if meets_condition {
            contents.push(content);
        }
    }
    
    Ok(contents)
}

/* ------------------ 最大スコア取得 ------------------ */
#[tauri::command]
pub fn get_max_scores_by_tendency(
    state: tauri::State<'_, Db>,
    problem_set_id: i64,
) -> Result<Vec<(i64, String, i32)>, String> {
    let conn = state.0.lock().unwrap();
    
    // 問題セットの各傾向の最大スコアを計算
    // 各質問において、その傾向の最大重みを取得し、それらを合計する
    let mut stmt = conn
        .prepare(
            "SELECT 
                t.id as tendency_id,
                t.name as tendency_name,
                COALESCE(SUM(max_weights.max_weight), 0) as max_score
             FROM tendency t
             LEFT JOIN (
                 SELECT 
                     a.tendency_id,
                     q.id as question_id,
                     MAX(a.weight) as max_weight
                 FROM answers a
                 JOIN questions q ON a.question_id = q.id
                 WHERE q.problem_set_id = ?1
                 GROUP BY a.tendency_id, q.id
             ) max_weights ON t.id = max_weights.tendency_id
             GROUP BY t.id, t.name
             ORDER BY t.id"
        )
        .map_err(|e| e.to_string())?;
    
    let rows = stmt
        .query_map(params![problem_set_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,      // tendency_id
                row.get::<_, String>(1)?,   // tendency_name
                row.get::<_, i32>(2)?       // max_score
            ))
        })
        .map_err(|e| e.to_string())?;
    
    let max_scores: Vec<(i64, String, i32)> = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(max_scores)
}
