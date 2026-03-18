import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./AnswerMasterPage.css";

// ---------------- 型定義 ----------------
type User = {
  id: number;
  name: string;
  gender: string;
  birth_date: string;
  notes: string;
  created_at: string;
};

// ---------------- 本体 ----------------
const UserMasterPage: React.FC = () => {
  /* DB から取得したユーザー一覧 */
  const [users, setUsers] = useState<User[]>([]);
  /* 入力フォーム */
  const [name, setName] = useState("");
  const [gender, setGender] = useState("男性");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");
  /* 入力フォーム表示状態 */
  const [showCreateForm, setShowCreateForm] = useState(false);
  /* 編集状態 */
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  /* トースト表示 */
  const [toast, setToast] = useState<string | null>(null);

  // ===== バリデーション・ユーティリティ =====
  
  // yyyymmdd形式の日付をバリデートする関数
  const isValidDate = (dateStr: string): boolean => {
    if (!/^\d{8}$/.test(dateStr)) return false;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6));
    const day = parseInt(dateStr.substring(6, 8));
    
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    // より厳密な日付チェック
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  };

  // yyyymmdd形式から年齢を計算する関数
  const calculateAge = (birthDate: string): number => {
    if (!isValidDate(birthDate)) return 0;
    
    const year = parseInt(birthDate.substring(0, 4));
    const month = parseInt(birthDate.substring(4, 6));
    const day = parseInt(birthDate.substring(6, 8));
    
    const birth = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // yyyymmdd形式を yyyy年mm月dd日 形式に変換する関数
  const formatDateDisplay = (dateStr: string): string => {
    if (!isValidDate(dateStr)) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}年${month}月${day}日`;
  };

  // 生年月日入力のハンドラー（数字のみ許可、8桁まで）
  const handleBirthDateChange = (value: string, setter: (value: string) => void) => {
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length <= 8) {
      setter(numericValue);
    }
  };

  // 日時をフォーマットする関数
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // バリデーション関数
  const validateBirthDate = (dateStr: string): boolean => {
    return dateStr.trim() !== '' && isValidDate(dateStr);
  };

  // ===== API =====
  const load = async () => {
    try {
      const data = await invoke<User[]>("list_users");
      setUsers(data);
    } catch (err) {
      console.error("ユーザー一覧取得エラー:", err);
    }
  };

  const addUser = async () => {
    if (!name.trim() || !validateBirthDate(birthDate)) {
      showToast("氏名と生年月日（8桁のyyyymmdd形式）は必須です");
      return;
    }
    
    try {
      await invoke("add_user", {
        name: name.trim(),
        gender: gender,
        birthDate: birthDate,
        notes: notes.trim(),
      });
      setName("");
      setGender("男性");
      setBirthDate("");
      setNotes("");
      setShowCreateForm(false);
      await load();
      showToast("ユーザーを登録しました");
    } catch (err) {
      console.error("ユーザー登録エラー:", err);
      showToast("ユーザーの登録に失敗しました");
    }
  };

  const editUser = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditGender(user.gender);
    setEditBirthDate(user.birth_date);
    setEditNotes(user.notes);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditName("");
    setEditGender("");
    setEditBirthDate("");
    setEditNotes("");
  };

  const saveEdit = async () => {
    if (!editingUser || !editName.trim() || !validateBirthDate(editBirthDate)) {
      showToast("氏名と生年月日（8桁のyyyymmdd形式）は必須です");
      return;
    }
    
    try {
      await invoke("update_user", {
        id: editingUser.id,
        name: editName.trim(),
        gender: editGender,
        birthDate: editBirthDate,
        notes: editNotes.trim(),
      });
      cancelEdit();
      await load();
      showToast("ユーザー情報を更新しました");
    } catch (err) {
      console.error("ユーザー更新エラー:", err);
      showToast("ユーザー情報の更新に失敗しました");
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`「${user.name}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }
    
    try {
      await invoke("delete_user", { id: user.id });
      await load();
      showToast("ユーザーを削除しました");
    } catch (err) {
      console.error("ユーザー削除エラー:", err);
      showToast("ユーザーの削除に失敗しました");
    }
  };

  const cancelCreate = () => {
    setName("");
    setGender("男性");
    setBirthDate("");
    setNotes("");
    setShowCreateForm(false);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // ===== 初期ロード =====
  useEffect(() => {
    load();
  }, []);

  // ===== 画面 =====
  return (
    <div className="answer-root">
      <h1 className="answer-title">ユーザー管理</h1>

      {/* ---- 既存ユーザー一覧とプラスボタン ---- */}
      <div className="answer-grid">
        {users.map((user) => (
          <div key={user.id} className="answer-card">
            {editingUser?.id === user.id ? (
              // 編集モード
              <div>
                <div className="answer-card-header">
                  <span className="answer-label">ユーザー #{user.id} 編集中</span>
                </div>
                <input
                  className="answer-textarea"
                  placeholder="氏名"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ height: 'auto', minHeight: '2.5rem' }}
                />
                <select
                  className="answer-textarea"
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  style={{ height: 'auto', minHeight: '2.5rem' }}
                >
                  <option value="男性">男性</option>
                  <option value="女性">女性</option>
                  <option value="その他">その他</option>
                </select>
                <input
                  type="text"
                  className="answer-textarea"
                  placeholder="生年月日（yyyymmdd）"
                  value={editBirthDate}
                  onChange={(e) => handleBirthDateChange(e.target.value, setEditBirthDate)}
                  style={{ height: 'auto', minHeight: '2.5rem' }}
                  maxLength={8}
                />
                {editBirthDate && !isValidDate(editBirthDate) && (
                  <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    有効な日付を8桁で入力してください（例: 19900415）
                  </div>
                )}
                <textarea
                  className="answer-textarea"
                  rows={3}
                  placeholder="備考 (任意)"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    className="confirm-modal-btn cancel"
                    onClick={cancelEdit}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    キャンセル
                  </button>
                  <button
                    className="confirm-modal-btn"
                    onClick={saveEdit}
                    disabled={!editName.trim() || !validateBirthDate(editBirthDate)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      opacity: (editName.trim() && validateBirthDate(editBirthDate)) ? 1 : 0.5,
                      cursor: (editName.trim() && validateBirthDate(editBirthDate)) ? 'pointer' : 'not-allowed'
                    }}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              // 表示モード
              <div>
                <div className="answer-card-header">
                  <span className="answer-label">ユーザー #{user.id}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="answer-delete-btn" 
                      onClick={() => editUser(user)}
                      style={{ color: '#2563eb' }}
                    >
                      編集
                    </button>
                    <button 
                      className="answer-delete-btn" 
                      onClick={() => deleteUser(user)}
                    >
                      削除
                    </button>
                  </div>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                  {user.name}
                </h3>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  <div><strong>性別:</strong> {user.gender}</div>
                  <div><strong>生年月日:</strong> {formatDateDisplay(user.birth_date)} ({calculateAge(user.birth_date)}歳)</div>
                </div>
                {user.notes && (
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                    {user.notes}
                  </p>
                )}
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  <div>
                    登録日: {formatDateTime(user.created_at)}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* プラスボタンカード */}
        <div className="answer-add-card" onClick={() => setShowCreateForm(true)}>
          <div className="add-icon">➕</div>
          <div>新しいユーザーを追加</div>
        </div>
      </div>

      {/* ---- 新規追加フォーム（モーダル風） ---- */}
      {showCreateForm && (
        <div className="confirm-modal">
          <div className="confirm-modal-content">
            <h3 className="confirm-modal-title">新規ユーザー登録</h3>
            <div style={{ marginBottom: '20px' }}>
              <input
                className="answer-textarea"
                placeholder="氏名"
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
              <select
                className="answer-textarea"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                style={{ 
                  height: 'auto', 
                  minHeight: '2.5rem',
                  marginBottom: '16px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <option value="男性">男性</option>
                <option value="女性">女性</option>
                <option value="その他">その他</option>
              </select>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                  生年月日（yyyymmdd）
                </label>
                <input
                  type="text"
                  className="answer-textarea"
                  placeholder="例: 19900415"
                  value={birthDate}
                  onChange={(e) => handleBirthDateChange(e.target.value, setBirthDate)}
                  style={{ 
                    height: 'auto', 
                    minHeight: '2.5rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  maxLength={8}
                />
                {birthDate && !isValidDate(birthDate) && (
                  <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    有効な日付を8桁で入力してください（例: 19900415）
                  </div>
                )}
              </div>
              <textarea
                className="answer-textarea"
                rows={3}
                placeholder="備考 (任意)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
                onClick={addUser}
                disabled={!name.trim() || !validateBirthDate(birthDate)}
                style={{
                  opacity: (name.trim() && validateBirthDate(birthDate)) ? 1 : 0.5,
                  cursor: (name.trim() && validateBirthDate(birthDate)) ? 'pointer' : 'not-allowed'
                }}
              >
                登録
              </button>
            </div>
          </div>
        </div>
      )}

      {/* トースト表示 */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#374151',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
};

export default UserMasterPage;
