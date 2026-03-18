import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link, useNavigate } from "react-router-dom";
import "./AnswerMasterPage.css";

// ---------------- 型定義 ----------------
type ResultSet = {
  id: number;
  name: string;
  description: string;
};

// ---------------- 本体 ----------------
const ResultSetMasterPage: React.FC = () => {
  /* DB から取得したセット一覧 */
  const [sets, setSets] = useState<ResultSet[]>([]);
  /* 入力フォーム */
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  /* 入力フォーム表示状態 */
  const [showCreateForm, setShowCreateForm] = useState(false);
  /* 画面遷移 */
  const nav = useNavigate();

  // ===== API =====
  const load = async () => {
    const data = await invoke<ResultSet[]>("list_result_sets");
    setSets(data);
  };

  const addSet = async () => {
    if (!name.trim()) return;
    const newId = await invoke<number>("add_result_set", {
      name: name.trim(),
      description: desc.trim(),
    });
    setName("");
    setDesc("");
    setShowCreateForm(false); // フォームを閉じる
    await load();
    // 作成後は結果マスターへ自動遷移
    nav(`/result-master/${newId}`);
  };

  const cancelCreate = () => {
    setName("");
    setDesc("");
    setShowCreateForm(false);
  };

  // ===== 初期ロード =====
  useEffect(() => {
    load();
  }, []);

  // ===== 画面 =====
  return (
    <div className="answer-root">
      <h1 className="answer-title">結果セット管理</h1>

      {/* ---- 既存セット一覧とプラスボタン ---- */}
      <div className="answer-grid">
        {sets.map((s) => (
          <div key={s.id} className="answer-card">
            <div className="answer-card-header">
              <span className="answer-label">結果セット #{s.id}</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              <Link 
                to={`/result-master/${s.id}`} 
                style={{ color: '#2563eb', textDecoration: 'none' }}
                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                {s.name}
              </Link>
            </h3>
            {s.description && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>
                {s.description}
              </p>
            )}
          </div>
        ))}
        
        {/* プラスボタンカード */}
        <div className="answer-add-card" onClick={() => setShowCreateForm(true)}>
          <div className="add-icon">➕</div>
          <div>新しい結果セットを追加</div>
        </div>
      </div>

      {/* ---- 新規追加フォーム（モーダル風） ---- */}
      {showCreateForm && (
        <div className="confirm-modal">
          <div className="confirm-modal-content">
            <h3 className="confirm-modal-title">新規結果セット作成</h3>
            <div style={{ marginBottom: '20px' }}>
              <input
                className="answer-textarea problem-set-form-input"
                placeholder="結果セット名を入力してください"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ 
                  height: 'auto', 
                  minHeight: '2.5rem',
                  marginBottom: '16px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
              <textarea
                className="answer-textarea problem-set-form-input"
                rows={3}
                placeholder="説明 (任意)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                style={{ 
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-btn cancel" onClick={cancelCreate}>
                キャンセル
              </button>
              <button 
                className="confirm-modal-btn" 
                onClick={addSet}
                disabled={!name.trim()}
                style={{
                  opacity: name.trim() ? 1 : 0.5,
                  cursor: name.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultSetMasterPage;
