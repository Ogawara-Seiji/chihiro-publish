import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate, useParams } from "react-router-dom";
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

type ProblemSet = {
  id: number;
  name: string;
  description: string;
  result_set_id: number;
  created_at: string;
};

type ResponseSession = {
  id: number;
  user_id: number;
  user_name: string;
  problem_set_id: number;
  problem_set_name: string;
  response_date: string;
  created_at: string;
};

const ProblemSelectPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [problemSets, setProblemSets] = useState<ProblemSet[]>([]);
  const [responseHistory, setResponseHistory] = useState<{[key: number]: ResponseSession[]}>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      setLoading(true);
      const userIdNum = Number(userId);
      console.log("Loading data for userId:", userIdNum);
      
      // ユーザー情報取得
      console.log("Fetching user data...");
      const userData = await invoke<User>("get_user", { id: userIdNum });
      console.log("User data:", userData);
      setUser(userData);
      
      // 結果セットが設定された問題セット一覧取得
      console.log("Fetching problem sets with results...");
      const problemSetsData = await invoke<ProblemSet[]>("get_problem_sets_with_results");
      console.log("Problem sets data:", problemSetsData);
      setProblemSets(problemSetsData);
      
      // 各問題セットの回答履歴を取得
      const historyData: {[key: number]: ResponseSession[]} = {};
      for (const problemSet of problemSetsData) {
        try {
          const history = await invoke<ResponseSession[]>("get_user_response_history", {
            userId: userIdNum,
            problemSetId: problemSet.id
          });
          console.log(`Problem set ${problemSet.id} history:`, history);
          if (history.length > 0) {
            // 最新の回答履歴の日付を詳しくログ出力
            console.log(`Problem set ${problemSet.id} latest response_date:`, history[0].response_date);
            console.log(`Problem set ${problemSet.id} latest created_at:`, history[0].created_at);
            historyData[problemSet.id] = history;
          }
        } catch (err) {
          // 履歴がない場合はエラーが出るかもしれないが無視
          console.log(`Problem set ${problemSet.id} has no history for user ${userIdNum}`);
        }
      }
      setResponseHistory(historyData);
      console.log("Response history:", historyData);
      
    } catch (err) {
      console.error("データ取得エラー:", err);
      alert(`データ取得エラー: ${err}`);
    } finally {
      setLoading(false);
      console.log("Loading completed");
    }
  };

  const selectProblemSet = (problemSetId: number) => {
    navigate(`/response/${userId}/${problemSetId}`);
  };

  const goBack = () => {
    navigate("/user-select");
  };

  // yyyymmdd形式を yyyy年mm月dd日 形式に変換
  const formatDate = (dateStr: string): string => {
    if (!/^\d{8}$/.test(dateStr)) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}年${month}月${day}日`;
  };

  // SQLのdate()関数から返される日付（YYYY-MM-DD形式）を yyyy年mm月dd日 形式に変換
  const formatDateTime = (dateStr: string): string => {
    console.log("formatDateTime input:", dateStr);
    
    // YYYY-MM-DD形式の場合（SQLのdate()関数の結果）
    if (dateStr.includes('-') && dateStr.length === 10) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        return `${year}年${parseInt(month)}月${parseInt(day)}日`;
      }
    }
    
    // YYYYMMDD形式の場合（response_dateフィールドの形式）
    if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${year}年${parseInt(month)}月${parseInt(day)}日`;
    }
    
    // ISO形式の場合（created_atなど）
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
      }
    } catch (e) {
      console.error("Date parsing error:", e);
    }
    
    // フォールバック
    return dateStr;
  };

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="answer-root">
        <h1 className="answer-title">問題選択</h1>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="answer-root">
        <h1 className="answer-title">問題選択</h1>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>ユーザーが見つかりません。</p>
          <button onClick={goBack}>戻る</button>
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
        <h1 className="answer-title" style={{ margin: 0 }}>問題選択</h1>
      </div>

      {/* ユーザー情報表示 */}
      <div style={{
        backgroundColor: '#f3f4f6',
        padding: '1rem',
        borderRadius: '0.5rem',
        marginBottom: '1.5rem',
        border: '1px solid #d1d5db'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
          回答者: {user.name} ({user.gender}, {formatDate(user.birth_date)})
        </h3>
        {user.notes && (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {user.notes}
          </p>
        )}
      </div>

      {problemSets.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
            回答可能な問題セットがありません。
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            問題セットマスターで結果セットが関連付けられた問題セットを作成してください。
          </p>
        </div>
      ) : (
        <div className="answer-grid">
          {problemSets.map((problemSet) => {
            const history = responseHistory[problemSet.id];
            const hasHistory = history && history.length > 0;
            
            return (
              <div 
                key={problemSet.id} 
                className="answer-card"
                onClick={() => selectProblemSet(problemSet.id)}
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
                  <span className="answer-label">問題セット #{problemSet.id}</span>
                </div>
                <h3 style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: '600', 
                  marginBottom: '0.5rem',
                  color: '#111827'
                }}>
                  {problemSet.name}
                </h3>
                {problemSet.description && (
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                    {problemSet.description}
                  </p>
                )}
                
                {hasHistory && (
                  <div style={{
                    backgroundColor: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '0.25rem',
                    padding: '0.5rem',
                    marginTop: '0.5rem'
                  }}>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.75rem', 
                      color: '#92400e',
                      fontWeight: '600'
                    }}>
                      📝 {formatDateTime(history[0].response_date)}に回答したことがあります
                    </p>
                    {history.length > 1 && (
                      <p style={{ 
                        margin: '0.25rem 0 0 0', 
                        fontSize: '0.75rem', 
                        color: '#92400e'
                      }}>
                        計{history.length}回回答済み
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProblemSelectPage;
