import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// 型定義
type ResponseSession = {
  id: number;
  user_id: number;
  user_name: string;
  problem_set_id: number;
  problem_set_name: string;
  response_date: string;
  created_at: string;
};

type Question = {
  id: number;
  text: string;
  created_at: string;
};

type Answer = {
  id: number;
  question_id: number;
  answer_index: number;
  text: string;
  tendency_id: number;
  weight: number;
  tendency_name?: string;
};

type UserResponse = {
  id: number;
  user_id: number;
  problem_set_id: number;
  question_id: number;
  answer_id: number;
  score: number;
  tendency_id: number | null;
  created_at: string;
};

type Tendency = {
  id: number;
  name: string;
  description: string;
};

type QuestionComparisonData = {
  question: Question;
  session1Answer: Answer | null;
  session2Answer: Answer | null;
  hasChanged: boolean;
  scoreChange: number;
  tendencyChange: string;
};

interface SessionComparisonComponentProps {
  selectedUser: number | null;
  selectedProblemSet: number | null;
  responseSessions: ResponseSession[];
  onClose: () => void;
}

const SessionComparisonComponent: React.FC<SessionComparisonComponentProps> = ({
  selectedUser,
  selectedProblemSet,
  responseSessions,
  onClose
}) => {
  const [comparisonSessions, setComparisonSessions] = useState<ResponseSession[]>([]);
  const [selectedSession1, setSelectedSession1] = useState<number | null>(null);
  const [selectedSession2, setSelectedSession2] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [questionComparisons, setQuestionComparisons] = useState<QuestionComparisonData[]>([]);
  const [tendencyStats, setTendencyStats] = useState<any[]>([]);

  const formatDateTime = (dateStr: string): string => {
    // YYYY-MM-DD形式の場合
    if (dateStr.includes('-') && dateStr.length === 10) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        return `${year}年${parseInt(month)}月${parseInt(day)}日`;
      }
    }
    
    // YYYYMMDD形式の場合
    if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${year}年${parseInt(month)}月${parseInt(day)}日`;
    }
    
    // ISO形式の場合
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
      }
    } catch (e) {
      console.error("Date parsing error:", e);
    }
    
    return dateStr;
  };

  useEffect(() => {
    if (selectedUser && selectedProblemSet) {
      loadComparisonSessions();
    }
  }, [selectedUser, selectedProblemSet]);

  const loadComparisonSessions = () => {
    const userSessions = responseSessions.filter(
      session => session.user_id === selectedUser && session.problem_set_id === selectedProblemSet
    );
    
    // 日付順でソート（最新が最初）
    userSessions.sort((a, b) => new Date(b.response_date).getTime() - new Date(a.response_date).getTime());
    
    setComparisonSessions(userSessions);
    
    // デフォルトで最新2つを選択
    if (userSessions.length >= 2) {
      setSelectedSession1(userSessions[0].id);
      setSelectedSession2(userSessions[1].id);
    } else if (userSessions.length === 1) {
      setSelectedSession1(userSessions[0].id);
      setSelectedSession2(null);
    }
  };

  const performComparison = async () => {
    if (!selectedSession1) return;
    
    setLoading(true);
    try {
      // 問題セットの質問一覧を取得
      const questions = await invoke<Question[]>("get_questions", { 
        problemSetId: selectedProblemSet 
      });

      // 傾向一覧を取得
      const tendencies = await invoke<Tendency[]>("list_tendencies");
      const tendencyMap = new Map(tendencies.map(t => [t.id, t.name]));

      // セッション1の回答を取得
      const session1Responses = await invoke<UserResponse[]>("get_session_responses", { 
        sessionId: selectedSession1
      });

      // セッション2の回答を取得（選択されている場合）
      const session2Responses = selectedSession2 ? 
        await invoke<UserResponse[]>("get_session_responses", { 
          sessionId: selectedSession2
        }) : [];

      const comparisons: QuestionComparisonData[] = [];
      const tendencyChanges = new Map();

      for (const question of questions) {
        // 各質問の選択肢を取得
        const answers = await invoke<Answer[]>("list_answers", { 
          questionId: question.id 
        });

        // 選択肢に傾向名を追加
        const answersWithTendency = answers.map(answer => ({
          ...answer,
          tendency_name: tendencyMap.get(answer.tendency_id) || '不明'
        }));

        // セッション1での回答
        const session1Response = session1Responses.find(r => r.question_id === question.id);
        const session1Answer = session1Response ? 
          answersWithTendency.find(a => a.id === session1Response.answer_id) || null : null;

        // セッション2での回答
        const session2Response = session2Responses.find(r => r.question_id === question.id);
        const session2Answer = session2Response ? 
          answersWithTendency.find(a => a.id === session2Response.answer_id) || null : null;

        const hasChanged = session1Answer?.id !== session2Answer?.id;
        const scoreChange = (session1Answer?.weight || 0) - (session2Answer?.weight || 0);
        
        let tendencyChange = "変化なし";
        if (hasChanged && session1Answer && session2Answer) {
          if (session1Answer.tendency_id !== session2Answer.tendency_id) {
            tendencyChange = `${session2Answer.tendency_name} → ${session1Answer.tendency_name}`;
          } else {
            tendencyChange = "同じ傾向内で変化";
          }
        } else if (hasChanged && session1Answer && !session2Answer) {
          tendencyChange = `未回答 → ${session1Answer.tendency_name}`;
        } else if (hasChanged && !session1Answer && session2Answer) {
          tendencyChange = `${session2Answer.tendency_name} → 未回答`;
        }

        // 傾向別統計を更新
        if (hasChanged && session1Answer && session2Answer) {
          const oldTendency = session2Answer.tendency_name || '不明';
          const newTendency = session1Answer.tendency_name || '不明';
          
          if (oldTendency !== newTendency) {
            if (!tendencyChanges.has(oldTendency)) {
              tendencyChanges.set(oldTendency, { lost: 0, gained: 0 });
            }
            if (!tendencyChanges.has(newTendency)) {
              tendencyChanges.set(newTendency, { lost: 0, gained: 0 });
            }
            
            tendencyChanges.get(oldTendency).lost += 1;
            tendencyChanges.get(newTendency).gained += 1;
          }
        }

        comparisons.push({
          question,
          session1Answer,
          session2Answer,
          hasChanged,
          scoreChange,
          tendencyChange
        });
      }

      // 傾向統計を配列に変換
      const tendencyStatsArray = Array.from(tendencyChanges.entries()).map(([name, stats]) => ({
        name,
        lost: stats.lost,
        gained: stats.gained,
        net: stats.gained - stats.lost
      }));

      setQuestionComparisons(comparisons);
      setTendencyStats(tendencyStatsArray);
      
    } catch (error) {
      console.error("比較処理エラー:", error);
      alert(`比較処理でエラーが発生しました: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedUser || !selectedProblemSet) {
    return (
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <p style={{ color: '#6b7280', fontSize: '1rem' }}>
          ユーザーと問題セットを選択してください
        </p>
      </div>
    );
  }

  if (comparisonSessions.length < 1) {
    return (
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <p style={{ color: '#6b7280', fontSize: '1rem' }}>
          選択したユーザーの回答データがありません
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#f9fafb',
      padding: '2rem',
      borderRadius: '0.5rem',
      border: '1px solid #e5e7eb'
    }}>
      {/* ヘッダー */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h3 style={{ color: '#374151', margin: 0 }}>
          📊 セッション別回答比較
        </h3>
        <button
          onClick={onClose}
          style={{
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          閉じる
        </button>
      </div>

      {/* セッション選択 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginBottom: '1.5rem',
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontSize: '0.875rem', 
            color: '#374151', 
            fontWeight: '600'
          }}>
            比較元セッション（新しい回答）
          </label>
          <select
            value={selectedSession1 || ''}
            onChange={(e) => setSelectedSession1(e.target.value ? Number(e.target.value) : null)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="">セッションを選択</option>
            {comparisonSessions.map((session, index) => (
              <option key={session.id} value={session.id}>
                {index + 1}回目: {formatDateTime(session.response_date)}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontSize: '0.875rem', 
            color: '#374151', 
            fontWeight: '600'
          }}>
            比較先セッション（古い回答）
          </label>
          <select
            value={selectedSession2 || ''}
            onChange={(e) => setSelectedSession2(e.target.value ? Number(e.target.value) : null)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="">セッションを選択（任意）</option>
            {comparisonSessions.map((session, index) => (
              <option key={session.id} value={session.id}>
                {index + 1}回目: {formatDateTime(session.response_date)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 比較実行ボタン */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <button
          onClick={performComparison}
          disabled={!selectedSession1 || loading}
          style={{
            backgroundColor: selectedSession1 && !loading ? '#3b82f6' : '#e5e7eb',
            color: selectedSession1 && !loading ? 'white' : '#9ca3af',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.75rem 2rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: selectedSession1 && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease'
          }}
        >
          {loading ? '比較中...' : '回答比較を実行'}
        </button>
      </div>

      {/* 変化サマリー */}
      {tendencyStats.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb',
          marginBottom: '2rem'
        }}>
          <h4 style={{ color: '#374151', marginBottom: '1rem' }}>
            � 傾向の変化サマリー
          </h4>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {tendencyStats.map((stat, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                backgroundColor: stat.net > 0 ? '#ecfdf5' : stat.net < 0 ? '#fef2f2' : '#f8fafc',
                borderRadius: '0.5rem',
                border: `2px solid ${stat.net > 0 ? '#a7f3d0' : stat.net < 0 ? '#fca5a5' : '#e2e8f0'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ 
                    fontSize: '1.5rem',
                    color: stat.net > 0 ? '#10b981' : stat.net < 0 ? '#ef4444' : '#6b7280'
                  }}>
                    {stat.net > 0 ? '📈' : stat.net < 0 ? '📉' : '➡️'}
                  </span>
                  <span style={{ fontWeight: '600', color: '#374151', fontSize: '1rem' }}>
                    {stat.name}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: stat.net > 0 ? '#10b981' : stat.net < 0 ? '#ef4444' : '#6b7280'
                  }}>
                    {stat.net > 0 ? '+' : ''}{stat.net}問
                  </div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: '#6b7280',
                    marginTop: '0.25rem'
                  }}>
                    {stat.net > 0 ? '増加' : stat.net < 0 ? '減少' : '変化なし'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f8fafc',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            💡 この傾向に該当する質問への回答が増えた（+）か減った（-）かを表示しています
          </div>
        </div>
      )}

      {/* 質問別比較結果 */}
      {questionComparisons.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ color: '#374151', marginBottom: '1.5rem' }}>
            📝 質問別回答比較
          </h4>
          
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {questionComparisons.map((comparison, index) => (
              <div key={comparison.question.id} style={{
                backgroundColor: comparison.hasChanged ? '#fef7f0' : '#f8fafc',
                padding: '1.5rem',
                borderRadius: '0.5rem',
                border: `2px solid ${comparison.hasChanged ? '#fed7aa' : '#e2e8f0'}`
              }}>
                {/* 質問文 */}
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '1rem',
                  padding: '1rem',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1'
                }}>
                  【質問 {index + 1}】{comparison.question.text}
                </div>

                {/* 変化表示 */}
                {comparison.hasChanged && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#fef3c7',
                    borderRadius: '0.375rem',
                    border: '1px solid #f59e0b'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>⚡</span>
                    <span style={{ fontWeight: '600', color: '#92400e' }}>
                      回答が変化しました
                    </span>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: '#92400e',
                      backgroundColor: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem'
                    }}>
                      {comparison.tendencyChange}
                    </span>
                  </div>
                )}

                {/* 回答比較 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: selectedSession2 ? '1fr 1fr' : '1fr',
                  gap: '1rem'
                }}>
                  {/* 新しい回答 */}
                  <div style={{
                    backgroundColor: '#ecfdf5',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '2px solid #a7f3d0'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                      gap: '0.5rem'
                    }}>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '700',
                        backgroundColor: '#059669',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px'
                      }}>
                        新しい回答
                      </span>
                      {comparison.session1Answer && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#059669',
                          backgroundColor: 'white',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontWeight: '600'
                        }}>
                          {comparison.session1Answer.weight}点
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#065f46',
                      lineHeight: '1.5',
                      minHeight: '2.5rem'
                    }}>
                      {comparison.session1Answer ? (
                        <>
                          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                            {comparison.session1Answer.text}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            傾向: {comparison.session1Answer.tendency_name}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                          未回答
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 古い回答（比較対象がある場合のみ） */}
                  {selectedSession2 && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '2px solid #fca5a5'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                        gap: '0.5rem'
                      }}>
                        <span style={{
                          fontSize: '0.875rem',
                          fontWeight: '700',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px'
                        }}>
                          古い回答
                        </span>
                        {comparison.session2Answer && (
                          <span style={{
                            fontSize: '0.75rem',
                            color: '#dc2626',
                            backgroundColor: 'white',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontWeight: '600'
                          }}>
                            {comparison.session2Answer.weight}点
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#991b1b',
                        lineHeight: '1.5',
                        minHeight: '2.5rem'
                      }}>
                        {comparison.session2Answer ? (
                          <>
                            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                              {comparison.session2Answer.text}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              傾向: {comparison.session2Answer.tendency_name}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                            未回答
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* スコア変化表示 */}
                {selectedSession2 && comparison.scoreChange !== 0 && (
                  <div style={{
                    marginTop: '1rem',
                    textAlign: 'center',
                    padding: '0.75rem',
                    backgroundColor: comparison.scoreChange > 0 ? '#ecfdf5' : '#fef2f2',
                    borderRadius: '0.375rem',
                    border: `1px solid ${comparison.scoreChange > 0 ? '#a7f3d0' : '#fca5a5'}`
                  }}>
                    <span style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: comparison.scoreChange > 0 ? '#059669' : '#dc2626'
                    }}>
                      スコア変化: {comparison.scoreChange > 0 ? '+' : ''}{comparison.scoreChange}点
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionComparisonComponent;
