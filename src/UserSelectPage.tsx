import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import "./AnswerMasterPage.css";

// 型定義
type User = {
  id: number;
  name: string;
  gender: string;
  birth_date: string;
  notes: string;
  created_at: string;
};

const UserSelectPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // yyyymmdd形式を yyyy年mm月dd日 形式に変換
  const formatDate = (dateStr: string): string => {
    if (!/^\d{8}$/.test(dateStr)) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}年${month}月${day}日`;
  };

  // 年齢計算
  const calculateAge = (birthDate: string): number => {
    if (!/^\d{8}$/.test(birthDate)) return 0;
    
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

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await invoke<User[]>("list_users");
      setUsers(data);
    } catch (err) {
      console.error("ユーザー一覧取得エラー:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectUser = (userId: number) => {
    navigate(`/problem-select/${userId}`);
  };

  const goBack = () => {
    navigate("/response-start");
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (loading) {
    return (
      <div className="answer-root">
        <h1 className="answer-title">ユーザー選択</h1>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="answer-root">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={goBack}
          style={{
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            cursor: 'pointer',
            marginRight: '1rem'
          }}
        >
          ← 戻る
        </button>
        <h1 className="answer-title" style={{ margin: 0 }}>ユーザー選択</h1>
      </div>

      {users.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
            登録されているユーザーがありません。
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            先にユーザーマスターからユーザーを登録してください。
          </p>
        </div>
      ) : (
        <div className="answer-grid">
          {users.map((user) => (
            <div 
              key={user.id} 
              className="answer-card"
              onClick={() => selectUser(user.id)}
              style={{ cursor: 'pointer' }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
            >
              <div className="answer-card-header">
                <span className="answer-label">ユーザー #{user.id}</span>
              </div>
              <h3 style={{ 
                fontSize: '1.2rem', 
                fontWeight: '600', 
                marginBottom: '0.5rem',
                color: '#111827'
              }}>
                {user.name}
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                <div><strong>性別:</strong> {user.gender}</div>
                <div><strong>生年月日:</strong> {formatDate(user.birth_date)} ({calculateAge(user.birth_date)}歳)</div>
              </div>
              {user.notes && (
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                  {user.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserSelectPage;
