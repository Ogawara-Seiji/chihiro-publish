import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link, useNavigate } from "react-router-dom";
import "./AnswerMasterPage.css";

// ---------------- 型定義 ----------------
type ProblemSet = {
  id: number;
  name: string;
  description: string;
  result_set_id?: number | null;
};

// ---------------- 本体 ----------------
const ProblemSetMasterPage: React.FC = () => {
  /* DB から取得したセット一覧 */
  const [sets, setSets] = useState<ProblemSet[]>([]);
  /* 入力フォーム */
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [resultSetId, setResultSetId] = useState<number | null>(null);
  const [resultSets, setResultSets] = useState<{ id: number; name: string; description: string }[]>([]);
  /* 入力フォーム表示状態 */
  const [showCreateForm, setShowCreateForm] = useState(false);
  /* 画面遷移 */
  const nav = useNavigate();

  // ===== API =====
  const load = async () => {
    const data = await invoke<ProblemSet[]>("list_problem_sets");
    setSets(data);
  };

  const loadResultSets = async () => {
    try {
      const data = await invoke<{ id: number; name: string; description: string }[]>("list_result_sets");
      setResultSets(data);
    } catch (error) {
      console.error("結果セットの取得に失敗:", error);
    }
  };

  const addSet = async () => {
    if (!name.trim()) return;
    const newId = await invoke<number>("add_problem_set", {
      name: name.trim(),
      description: desc.trim(),
      result_set_id: resultSetId,
    });
    setName("");
    setDesc("");
    setResultSetId(null);
    setShowCreateForm(false); // フォームを閉じる
    await load();
    // 作成後は回答マスターへ自動遷移
    nav(`/answer-master/${newId}`);
  };

  const cancelCreate = () => {
    setName("");
    setDesc("");
    setResultSetId(null);
    setShowCreateForm(false);
  };

  // ===== 初期ロード =====
  useEffect(() => {
    load();
    loadResultSets();
  }, []);

  // ===== 画面 =====
  return (
    <div className="answer-root">
      <h1 className="answer-title">問題セット管理</h1>

      {/* ---- 既存セット一覧とプラスボタン ---- */}
      <div className="answer-grid">
        {sets.map((s) => (
          <div key={s.id} className="answer-card">
            <div className="answer-card-header">
              <span className="answer-label">セット #{s.id}</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              <Link 
                to={`/answer-master/${s.id}`} 
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
            {s.result_set_id && (
              <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '500' }}>
                結果セット: {resultSets.find(rs => rs.id === s.result_set_id)?.name || `ID: ${s.result_set_id}`}
              </div>
            )}
          </div>
        ))}
        
        {/* プラスボタンカード */}
        <div className="answer-add-card" onClick={() => setShowCreateForm(true)}>
          <div className="add-icon">➕</div>
          <div>新しい問題セットを追加</div>
        </div>
      </div>

      {/* ---- 新規追加フォーム（モーダル風） ---- */}
      {showCreateForm && (
        <div className="confirm-modal">
          <div className="confirm-modal-content">
            <h3 className="confirm-modal-title">新規問題セット作成</h3>
            <div style={{ marginBottom: '20px' }}>
              <input
                className="answer-textarea problem-set-form-input"
                placeholder="セット名を入力してください"
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
                  marginBottom: '16px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  結果セット選択（任意）
                </label>
                <select
                  className="answer-textarea problem-set-form-input"
                  value={resultSetId || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setResultSetId(value ? Number(value) : null);
                  }}
                  style={{ 
                    height: 'auto', 
                    minHeight: '2.5rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">結果セットを選択しない</option>
                  {resultSets.map((resultSet) => (
                    <option key={resultSet.id} value={resultSet.id}>
                      {resultSet.name}
                    </option>
                  ))}
                </select>
              </div>
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

export default ProblemSetMasterPage;
