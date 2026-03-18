import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./AnswerMasterPage.css";

export type Tendency = {
  id: number;
  name: string;
  description: string;
};

const TendencyMasterPage: React.FC = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tendencies, setTendencies] = useState<Tendency[]>([]);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const fetchTendencies = async () => {
    setError("");
    try {
      const result = await invoke<Tendency[]>("list_tendencies");
      setTendencies(result);
    } catch (e) {
      setError("取得に失敗しました");
    }
  };

  useEffect(() => {
    fetchTendencies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !description.trim()) {
      setError("全て入力してください");
      return;
    }
    try {
      await invoke("add_tendency", { name, description });
      setName("");
      setDescription("");
      setShowCreateForm(false);
      fetchTendencies();
    } catch (e) {
      setError("保存に失敗しました");
    }
  };

  const handleCreateCancel = () => {
    setName("");
    setDescription("");
    setError("");
    setShowCreateForm(false);
  };

  const handleEdit = (t: Tendency) => {
    setEditId(t.id);
    setEditName(t.name);
    setEditDescription(t.description);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editDescription.trim() || editId === null) {
      setError("全て入力してください");
      return;
    }
    try {
      await invoke("update_tendency", { id: editId, name: editName, description: editDescription });
      setEditId(null);
      setEditName("");
      setEditDescription("");
      fetchTendencies();
    } catch (e) {
      setError("編集に失敗しました");
    }
  };

  const handleEditCancel = () => {
    setEditId(null);
    setEditName("");
    setEditDescription("");
    setError("");
  };

  const handleDelete = async (id: number) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (deleteTargetId === null) return;
    try {
      await invoke("delete_tendency", { id: deleteTargetId });
      fetchTendencies();
    } catch (e) {
      setError("削除に失敗しました");
    }
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
  };

  return (
    <div className="answer-root">
      <h1 className="answer-title">傾向マスター管理</h1>

      {/* ---- 既存傾向一覧とプラスボタン ---- */}
      <div className="answer-grid">
        {tendencies.map((t) => (
          <div key={t.id} className="answer-card">
            <div className="answer-card-header">
              <span className="answer-label">傾向 #{t.id}</span>
            </div>
            {editId === t.id ? (
              /* 編集モード */
              <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input
                  className="answer-textarea"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="傾向名"
                  autoFocus
                />
                <textarea
                  className="answer-textarea"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  placeholder="説明"
                />
                <div className="answer-save-row">
                  <button className="answer-save-btn" type="submit">
                    保存
                  </button>
                  <button
                    type="button"
                    className="answer-delete-btn"
                    onClick={handleEditCancel}
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            ) : (
              /* 表示モード */
              <>
                <h3 className="question-text">{t.name}</h3>
                <p className="tendency-description">{t.description}</p>
                <div className="answer-save-row">
                  <button
                    className="answer-save-btn"
                    onClick={() => handleEdit(t)}
                  >
                    ✏️ 編集
                  </button>
                  <button
                    className="answer-delete-btn"
                    onClick={() => handleDelete(t.id)}
                  >
                    🗑️ 削除
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        
        {/* プラスボタンカード */}
        <div className="answer-add-card" onClick={() => setShowCreateForm(true)}>
          <div className="add-icon">➕</div>
          <div>新しい傾向を追加</div>
        </div>
      </div>

      {/* ---- 新規作成フォーム（モーダル風） ---- */}
      {showCreateForm && (
        <div className="confirm-modal">
          <div className="confirm-modal-content">
            <h3 className="confirm-modal-title">新規傾向作成</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <input
                  className="answer-textarea problem-set-form-input"
                  type="text"
                  placeholder="傾向名を入力してください"
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
                  rows={4}
                  placeholder="説明を入力してください"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ 
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
                {error && (
                  <div style={{ 
                    color: '#ef4444', 
                    fontSize: '14px', 
                    marginTop: '8px',
                    textAlign: 'center'
                  }}>
                    {error}
                  </div>
                )}
              </div>
              <div className="confirm-modal-actions">
                <button 
                  type="button"
                  className="confirm-modal-btn cancel" 
                  onClick={handleCreateCancel}
                >
                  キャンセル
                </button>
                <button 
                  type="submit"
                  className="confirm-modal-btn" 
                  disabled={!name.trim() || !description.trim()}
                  style={{
                    opacity: (name.trim() && description.trim()) ? 1 : 0.5,
                    cursor: (name.trim() && description.trim()) ? 'pointer' : 'not-allowed'
                  }}
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- 削除確認モーダル ---- */}
      {showDeleteConfirm && (
        <div className="confirm-modal">
          <div className="confirm-modal-content">
            <h3 className="confirm-modal-title">傾向を削除</h3>
            <p className="confirm-modal-message">
              この傾向を削除してもよろしいですか？<br />
              削除後は元に戻せません。
            </p>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-btn cancel" onClick={cancelDelete}>
                キャンセル
              </button>
              <button className="confirm-modal-btn" onClick={confirmDelete}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TendencyMasterPage;
