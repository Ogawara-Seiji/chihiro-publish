import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import SessionComparisonComponent from "./SessionComparisonComponent";
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

type TendencyScore = {
  tendency_id: number;
  tendency_name: string;
  total_score: number;
  question_count: number;
  max_score: number;
};

type UserStatistics = {
  user_id: number;
  user_name: string;
  problem_set_id: number;
  problem_set_name: string;
  latest_response_date: string;
  total_responses: number;
  tendency_scores: TendencyScore[];
  latest_session_id: number;
  previous_session_id?: number;
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

type QuestionDetail = {
  question: Question;
  answers: Answer[];
  selected_answer: Answer | null;
  user_response: UserResponse | null;
  tendency_name: string | null;
};

const ResponseAggregationPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [problemSets, setProblemSets] = useState<ProblemSet[]>([]);
  const [responseSessions, setResponseSessions] = useState<ResponseSession[]>([]);
  const [userStatistics, setUserStatistics] = useState<UserStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProblemSet, setSelectedProblemSet] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'user-stats' | 'comparison'>('overview');
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [detailsData, setDetailsData] = useState<{
    userId: number;
    problemSetId: number;
    userName: string;
    problemSetName: string;
    questions: QuestionDetail[];
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [comparisonMode, setComparisonMode] = useState<'comparison' | 'history' | 'session-comparison'>('session-comparison');
  const [historyData, setHistoryData] = useState<any[] | null>(null);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      setLoading(true);
      console.log("Loading aggregation data...");
      
      // ユーザー一覧取得
      console.log("Fetching users...");
      const usersData = await invoke<User[]>("list_users");
      console.log("Users data:", usersData);
      setUsers(usersData);
      
      // 問題セット一覧取得
      console.log("Fetching problem sets...");
      const problemSetsData = await invoke<ProblemSet[]>("get_problem_sets_with_results");
      console.log("Problem sets data:", problemSetsData);
      setProblemSets(problemSetsData);
      
      // 傾向一覧取得
      console.log("Fetching tendencies...");
      const tendenciesData = await invoke<Tendency[]>("list_tendencies");
      console.log("Tendencies data:", tendenciesData);
      
      // 全ての回答セッション取得
      console.log("Fetching all response sessions...");
      const sessionsData = await invoke<ResponseSession[]>("list_response_sessions");
      console.log("Response sessions data:", sessionsData);
      setResponseSessions(sessionsData);
      
      // ユーザー統計を計算
      await calculateUserStatistics(usersData, problemSetsData, sessionsData, tendenciesData);
      
    } catch (err) {
      console.error("データ取得エラー:", err);
      alert(`データ取得エラー: ${err}`);
    } finally {
      setLoading(false);
      console.log("Loading completed");
    }
  };

  const calculateUserStatistics = async (
    usersData: User[],
    problemSetsData: ProblemSet[],
    sessionsData: ResponseSession[],
    tendenciesData: Tendency[]
  ) => {
    try {
      const statistics: UserStatistics[] = [];
      
      for (const user of usersData) {
        for (const problemSet of problemSetsData) {
          // このユーザーがこの問題セットに回答したセッションを取得
          const userSessions = sessionsData.filter(
            session => session.user_id === user.id && session.problem_set_id === problemSet.id
          );
          
          if (userSessions.length > 0) {
            // セッションを日付順でソート（最新が最初）
            userSessions.sort((a, b) => new Date(b.response_date).getTime() - new Date(a.response_date).getTime());
            
            const latestSession = userSessions[0];
            const previousSession = userSessions.length > 1 ? userSessions[1] : undefined;
            
            // 最新セッションの回答データを取得して傾向スコアを計算
            const tendencyScores = await getTendencyScores(user.id, problemSet.id, tendenciesData);
            
            statistics.push({
              user_id: user.id,
              user_name: user.name,
              problem_set_id: problemSet.id,
              problem_set_name: problemSet.name,
              latest_response_date: latestSession.response_date,
              total_responses: userSessions.length,
              tendency_scores: tendencyScores,
              latest_session_id: latestSession.id,
              previous_session_id: previousSession?.id
            });
          }
        }
      }
      
      setUserStatistics(statistics);
      console.log("User statistics calculated:", statistics);
    } catch (err) {
      console.error("統計計算エラー:", err);
    }
  };

  const getTendencyScores = async (
    userId: number, 
    problemSetId: number, 
    tendenciesData: Tendency[]
  ): Promise<TendencyScore[]> => {
    try {
      console.log(`Getting tendency scores for user ${userId}, problem set ${problemSetId}`);
      
      // 最新の回答セッションIDを取得
      const latestSessionId = await invoke<number>("get_latest_session_id", { 
        userId: userId, 
        problemSetId: problemSetId 
      });
      console.log(`Latest session ID:`, latestSessionId);
      
      // 最新セッションの回答詳細を取得
      const responses = await invoke<UserResponse[]>("get_session_responses", { 
        sessionId: latestSessionId
      });
      console.log(`Session responses:`, responses);
      
      // 問題セットの最大スコアを取得
      const maxScores = await invoke<[number, string, number][]>("get_max_scores_by_tendency", { 
        problemSetId: problemSetId 
      });
      console.log(`Max scores:`, maxScores);
      
      // 傾向ごとにスコアを集計
      const tendencyMap = new Map<number, { name: string; totalScore: number; count: number; maxScore: number }>();
      
      // 傾向データでマップを初期化（全ての傾向を含める）
      tendenciesData.forEach(tendency => {
        const maxScore = maxScores.find(([id, ,]) => id === tendency.id);
        tendencyMap.set(tendency.id, {
          name: tendency.name,
          totalScore: 0,
          count: 0,
          maxScore: maxScore ? maxScore[2] : 0 // 問題がない場合は0
        });
      });
      
      // 回答データから傾向スコアを集計
      responses.forEach(response => {
        if (response.tendency_id !== null) {
          const existing = tendencyMap.get(response.tendency_id);
          if (existing) {
            existing.totalScore += response.score;
            existing.count += 1;
          }
        }
      });
      
      // TendencyScore配列に変換（全ての傾向を含める）
      const tendencyScores: TendencyScore[] = Array.from(tendencyMap.entries())
        .map(([id, data]) => ({
          tendency_id: id,
          tendency_name: data.name,
          total_score: data.totalScore,
          question_count: data.count,
          max_score: data.maxScore
        }))
        .sort((a, b) => a.tendency_name.localeCompare(b.tendency_name)); // 名前順でソート
      
      console.log(`Calculated tendency scores:`, tendencyScores);
      return tendencyScores;
      
    } catch (err) {
      console.error("傾向スコア取得エラー:", err);
      // エラーの場合は空配列を返す
      return [];
    }
  };

  const getQuestionDetails = async (userId: number, problemSetId: number, userName: string, problemSetName: string) => {
    try {
      console.log(`Getting question details for user ${userId}, problem set ${problemSetId}`);
      
      // 問題セットの質問一覧を取得
      const questions = await invoke<Question[]>("get_questions", { 
        problemSetId: problemSetId 
      });
      console.log(`Questions:`, questions);
      
      // 傾向マスタデータを取得
      const tendencies = await invoke<any[]>("list_tendencies");
      const tendencyMap = new Map(tendencies.map(t => [t.id, t.name]));
      console.log(`Tendencies:`, tendencies);
      
      // 最新の回答セッションIDを取得
      const latestSessionId = await invoke<number>("get_latest_session_id", { 
        userId: userId, 
        problemSetId: problemSetId 
      });
      console.log(`Latest session ID:`, latestSessionId);
      
      // 最新セッションの回答詳細を取得（傾向名も含む）
      const responseDetails = await invoke<any[]>("get_response_details", { 
        sessionId: latestSessionId
      });
      console.log(`Response details:`, responseDetails);
      
      // 最新セッションの回答データも取得
      const userResponses = await invoke<UserResponse[]>("get_session_responses", { 
        sessionId: latestSessionId
      });
      console.log(`User responses:`, userResponses);
      
      // 各質問の詳細を構築
      const questionDetails: QuestionDetail[] = [];
      
      for (const question of questions) {
        // この質問の選択肢を取得
        const answers = await invoke<Answer[]>("list_answers", { 
          questionId: question.id 
        });
        
        // 各選択肢に傾向名を追加
        const answersWithTendency = answers.map(answer => ({
          ...answer,
          tendency_name: tendencyMap.get(answer.tendency_id) || '不明'
        }));
        
        // ユーザーの回答を検索
        const userResponse = userResponses.find(r => r.question_id === question.id);
        const selectedAnswer = userResponse ? answersWithTendency.find(a => a.id === userResponse.answer_id) || null : null;
        
        // 回答詳細から傾向名を取得
        const responseDetail = responseDetails.find(rd => rd.question_id === question.id);
        const tendencyName = responseDetail ? responseDetail.tendency_name : null;
        
        questionDetails.push({
          question,
          answers: answersWithTendency,
          selected_answer: selectedAnswer,
          user_response: userResponse || null,
          tendency_name: tendencyName
        });
      }
      
      // 順序でソート（IDでソート）
      questionDetails.sort((a, b) => a.question.id - b.question.id);
      
      setDetailsData({
        userId,
        problemSetId,
        userName,
        problemSetName,
        questions: questionDetails
      });
      
      setShowDetails(true);
      console.log(`Question details:`, questionDetails);
      
    } catch (err) {
      console.error("質問詳細取得エラー:", err);
      alert(`詳細取得エラー: ${err}`);
    }
  };

  const getSessionDetailData = async (sessionId: number) => {
    try {
      // セッション基本情報
      const session = responseSessions.find(s => s.id === sessionId);
      if (!session) throw new Error("セッションが見つかりません");
      
      // セッションの回答データを取得
      const responses = await invoke<UserResponse[]>("get_session_responses", { 
        sessionId: sessionId
      });
      
      // 傾向一覧取得
      const tendencies = await invoke<Tendency[]>("list_tendencies");
      
      // 問題セットの質問一覧を取得
      const questions = await invoke<Question[]>("get_questions", { 
        problemSetId: session.problem_set_id 
      });
      
      // 各質問の回答選択肢を取得
      const questionAnswerMap = new Map();
      for (const question of questions) {
        const answers = await invoke<Answer[]>("list_answers", { 
          questionId: question.id 
        });
        questionAnswerMap.set(question.id, { question, answers });
      }
      
      // 傾向ごとの詳細分析
      const tendencyAnalysis = tendencies.map(tendency => {
        // この傾向に関連する質問と回答を抽出
        const tendencyResponses = [];
        
        for (const response of responses) {
          const questionData = questionAnswerMap.get(response.question_id);
          if (questionData) {
            const selectedAnswer = questionData.answers.find((a: any) => a.id === response.answer_id);
            if (selectedAnswer && selectedAnswer.tendency_id === tendency.id) {
              tendencyResponses.push({
                question: questionData.question,
                selectedAnswer,
                response,
                weight: selectedAnswer.weight
              });
            }
          }
        }
        
        // この傾向の最大可能スコアを計算
        let maxPossibleScore = 0;
        let totalQuestions = 0;
        
        for (const [, questionData] of questionAnswerMap) {
          const tendencyAnswers = questionData.answers.filter((a: any) => a.tendency_id === tendency.id);
          if (tendencyAnswers.length > 0) {
            totalQuestions++;
            const maxWeight = Math.max(...tendencyAnswers.map((a: any) => a.weight));
            maxPossibleScore += maxWeight;
          }
        }
        
        // 実際の得点を計算
        const actualScore = tendencyResponses.reduce((sum, tr) => sum + tr.weight, 0);
        const percentage = maxPossibleScore > 0 ? (actualScore / maxPossibleScore) * 100 : 0;
        
        return {
          tendency_id: tendency.id,
          tendency_name: tendency.name,
          tendency_description: tendency.description,
          total_score: actualScore,
          max_possible_score: maxPossibleScore,
          question_count: totalQuestions,
          answered_count: tendencyResponses.length,
          percentage,
          responses: tendencyResponses,
          coverage: totalQuestions > 0 ? (tendencyResponses.length / totalQuestions) * 100 : 0
        };
      });
      
      return {
        session,
        responses,
        tendencyAnalysis: tendencyAnalysis.sort((a, b) => a.tendency_name.localeCompare(b.tendency_name)),
        totalQuestions: questions.length,
        answeredQuestions: responses.length
      };
    } catch (err) {
      console.error("セッション詳細データ取得エラー:", err);
      throw err;
    }
  };
const loadHistoryData = async () => {



    if (!selectedUser || !selectedProblemSet) return;
    
    try {
      console.log(`Loading history data for user ${selectedUser}, problem set ${selectedProblemSet}`);
      
      // このユーザー・問題セットの全セッションを取得
      const allSessions = responseSessions.filter(
        session => session.user_id === selectedUser && session.problem_set_id === selectedProblemSet
      );
      
      // 日付順でソート（古い順）
      allSessions.sort((a, b) => new Date(a.response_date).getTime() - new Date(b.response_date).getTime());
      
      const historyData = [];
      
      for (const session of allSessions) {
        const sessionData = await getSessionDetailData(session.id);
        historyData.push({
          ...sessionData,
          sessionNumber: historyData.length + 1
        });
      }
      
      setHistoryData(historyData);
      console.log('History data loaded:', historyData);
    } catch (err) {
      console.error("履歴データ取得エラー:", err);
      alert(`履歴データ取得エラー: ${err}`);
    }
  };

  const goBack = () => {
    navigate("/");
  };

  // 日付フォーマット関数
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

  const renderOverviewSection = () => (
    <div style={{
      backgroundColor: '#f9fafb',
      padding: '2rem',
      borderRadius: '0.5rem',
      border: '1px solid #e5e7eb',
      textAlign: 'center'
    }}>
      <h3 style={{ color: '#374151', marginBottom: '1rem' }}>
        概要統計
      </h3>
      
      {/* 基本統計 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#6b7280' }}>
            登録ユーザー数
          </h4>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
            {users.length}
          </p>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#6b7280' }}>
            問題セット数
          </h4>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
            {problemSets.length}
          </p>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#6b7280' }}>
            総回答セッション数
          </h4>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#111827' }}>
            {responseSessions.length}
          </p>
        </div>
      </div>
    </div>
  );

  const renderUserStatsSection = () => {
    const filteredStats = userStatistics.filter(stat => 
      (!selectedProblemSet || stat.problem_set_id === selectedProblemSet) &&
      (!selectedUser || stat.user_id === selectedUser)
    );

    return (
      <div style={{
        backgroundColor: '#f9fafb',
        padding: '2rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <h3 style={{ color: '#374151', marginBottom: '1rem' }}>
          ユーザー別統計 - 最新回答状況
        </h3>
        
        {filteredStats.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center' }}>
            該当するデータがありません
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredStats.map((stat) => (
              <div key={`${stat.user_id}-${stat.problem_set_id}`} style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: '#111827' }}>
                    {stat.user_name} - {stat.problem_set_name}
                  </h4>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <span>最新回答: {formatDateTime(stat.latest_response_date)}</span>
                      <span>総回答回数: {stat.total_responses}回</span>
                    </div>
                    <button
                      onClick={() => getQuestionDetails(stat.user_id, stat.problem_set_id, stat.user_name, stat.problem_set_name)}
                      style={{
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }}
                    >
                      詳細表示
                    </button>
                  </div>
                </div>
                
                {/* 傾向スコア表示 */}
                {stat.tendency_scores.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1rem'
                  }}>
                    {stat.tendency_scores.map((tendency) => {
                      const percentage = tendency.max_score > 0 
                        ? Math.min(100, (tendency.total_score / tendency.max_score) * 100)
                        : 0;
                      
                      return (
                        <div key={tendency.tendency_id} style={{
                          backgroundColor: tendency.question_count === 0 ? '#f1f5f9' : '#f8fafc',
                          padding: '1rem',
                          borderRadius: '0.25rem',
                          border: tendency.question_count === 0 ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                          opacity: tendency.question_count === 0 ? 0.7 : 1
                        }}>
                          <h5 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>
                            {tendency.tendency_name}
                            {tendency.question_count === 0 && (
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: '#64748b', 
                                marginLeft: '0.5rem' 
                              }}>
                                (未回答)
                              </span>
                            )}
                          </h5>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 'bold', color: '#1f2937' }}>合計: {tendency.total_score}点</span>
                            <span style={{ color: '#6b7280' }}>質問数: {tendency.question_count}問</span>
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>最大: {tendency.max_score}点</span>
                          </div>
                          
                          {/* スコアバー */}
                          <div style={{
                            backgroundColor: '#e5e7eb',
                            borderRadius: '0.25rem',
                            height: '0.5rem',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              backgroundColor: tendency.question_count === 0 ? '#9ca3af' : '#3b82f6',
                              height: '100%',
                              width: `${percentage}%`,
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          
                          {/* パーセンテージ表示 */}
                          <div style={{ 
                            textAlign: 'right', 
                            fontSize: '0.75rem', 
                            color: '#6b7280', 
                            marginTop: '0.25rem' 
                          }}>
                            {percentage.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: '#fef3c7',
                    padding: '1rem',
                    borderRadius: '0.25rem',
                    border: '1px solid #f59e0b',
                    textAlign: 'center'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>
                      傾向スコアが取得できませんでした
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderQuestionDetailsModal = () => {
    if (!showDetails || !detailsData) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '2rem',
          maxWidth: '95vw',
          width: '1200px',
          maxHeight: '90vh',
          overflow: 'auto',
          margin: '1rem',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: '#111827' }}>
              {detailsData.userName} - {detailsData.problemSetName}
            </h3>
            <button
              onClick={() => setShowDetails(false)}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer'
              }}
            >
              閉じる
            </button>
          </div>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {detailsData.questions.map((questionDetail, index) => (
              <div key={questionDetail.question.id} style={{
                backgroundColor: '#f9fafb',
                padding: '1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#374151' }}>
                  質問 {index + 1}
                </h4>
                <p style={{ 
                  margin: '0 0 1rem 0', 
                  color: '#111827', 
                  fontSize: '1.1rem',
                  lineHeight: '1.6',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}>
                  {questionDetail.question.text}
                </p>
                
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {questionDetail.answers.map((answer) => (
                    <div key={answer.id} style={{
                      backgroundColor: questionDetail.selected_answer?.id === answer.id ? '#dcfce7' : '#ffffff',
                      padding: '0.75rem',
                      borderRadius: '0.25rem',
                      border: questionDetail.selected_answer?.id === answer.id ? '2px solid #10b981' : '1px solid #e5e7eb',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ 
                        color: questionDetail.selected_answer?.id === answer.id ? '#065f46' : '#374151',
                        fontWeight: questionDetail.selected_answer?.id === answer.id ? 'bold' : 'normal',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-all',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        maxWidth: '100%'
                      }}>
                        {answer.text}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            fontWeight: 'normal'
                          }}>
                            {answer.tendency_name || '不明'}
                          </span>
                          <span style={{ 
                            fontSize: '0.875rem',
                            color: '#374151',
                            fontWeight: 'bold'
                          }}>
                            {answer.weight}点
                          </span>
                        </div>
                        {questionDetail.selected_answer?.id === answer.id && (
                          <span style={{ 
                            backgroundColor: '#10b981',
                            color: 'white',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            選択
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {questionDetail.user_response && questionDetail.tendency_name && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '0.25rem',
                    border: '1px solid #0ea5e9'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: 'bold',
                        backgroundColor: '#0ea5e9',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem'
                      }}>
                        {questionDetail.tendency_name}
                      </span>
                      <span style={{ 
                        fontSize: '0.875rem', 
                        color: '#0369a1', 
                        fontWeight: 'bold'
                      }}>
                        {questionDetail.user_response.score}点
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderComparisonSection = () => {
    return (
      <div style={{
        backgroundColor: '#f9fafb',
        padding: '2rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <h3 style={{ color: '#374151', marginBottom: '1rem' }}>
          変化比較 - 傾向の変化
        </h3>
        
        {/* 比較モード選択 */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          backgroundColor: 'white',
          padding: '0.5rem',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => setComparisonMode('session-comparison')}
            style={{
              backgroundColor: comparisonMode === 'session-comparison' ? '#3b82f6' : 'transparent',
              color: comparisonMode === 'session-comparison' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            質問別比較
          </button>
          <button
            onClick={() => setComparisonMode('history')}
            style={{
              backgroundColor: comparisonMode === 'history' ? '#3b82f6' : 'transparent',
              color: comparisonMode === 'history' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            履歴俯瞰
          </button>
        </div>

        {/* ユーザー選択の説明 */}
        <div style={{
          backgroundColor: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb',
          marginBottom: '1.5rem'
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            📝 <strong>使い方:</strong> 上部のフィルターでユーザーと問題セットを選択してから、比較や履歴の表示を行ってください。
          </p>
        </div>

        {/* 比較モードの内容 */}
        {comparisonMode === 'session-comparison' ? (
           <SessionComparisonComponent
             selectedUser={selectedUser}
             selectedProblemSet={selectedProblemSet}
             responseSessions={responseSessions}
             onClose={() => setComparisonMode('session-comparison')}
           />
         ) : renderHistoryMode()}
      </div>
    );
  };

  const renderHistoryMode = () => {
    if (!selectedUser || !selectedProblemSet) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
            ユーザーと問題セットを選択してください
          </p>
        </div>
      );
    }

    return (
      <div>
        {/* 履歴読み込みボタン */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <button
            onClick={loadHistoryData}
            style={{
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.75rem 2rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              boxShadow: '0 2px 4px 0 rgba(99, 102, 241, 0.2)'
            }}
          >
            履歴を読み込み
          </button>
        </div>

        {/* 履歴表示 */}
        {historyData && renderHistoryResults()}
      </div>
    );
  };

  // 統計分析関数を追加
  const calculateTendencyStatistics = (historyData: any[], tendencyName: string) => {
    const tendencyScores = historyData.map(session => {
      const tendency = session.tendencyAnalysis.find((t: any) => t.tendency_name === tendencyName);
      return tendency ? tendency.percentage : 0;
    });

    const mean = tendencyScores.reduce((sum, score) => sum + score, 0) / tendencyScores.length;
    const variance = tendencyScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / tendencyScores.length;
    const standardDeviation = Math.sqrt(variance);
    
    const sortedScores = [...tendencyScores].sort((a, b) => a - b);
    const median = sortedScores.length % 2 === 0 
      ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
      : sortedScores[Math.floor(sortedScores.length / 2)];

    const min = Math.min(...tendencyScores);
    const max = Math.max(...tendencyScores);
    const range = max - min;

    // トレンド分析（線形回帰の傾き）
    const n = tendencyScores.length;
    const sumX = (n * (n - 1)) / 2; // 0 + 1 + 2 + ... + (n-1)
    const sumY = tendencyScores.reduce((sum, score) => sum + score, 0);
    const sumXY = tendencyScores.reduce((sum, score, index) => sum + (index * score), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6; // 0² + 1² + 2² + ... + (n-1)²
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const trend = slope > 0.5 ? 'increasing' : slope < -0.5 ? 'decreasing' : 'stable';

    return {
      mean,
      median,
      standardDeviation,
      min,
      max,
      range,
      trend,
      slope,
      scores: tendencyScores
    };
  };

  const renderHistoryResults = () => {
    if (!historyData || historyData.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
            履歴データがありません
          </p>
        </div>
      );
    }

    // 傾向名の一覧を取得
    const tendencyNames = historyData[0].tendencyAnalysis.map((t: any) => t.tendency_name);

    return (
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <h4 style={{ margin: '0 0 1.5rem 0', color: '#111827' }}>
          📈 傾向分析履歴の俯瞰（全{historyData.length}回）
        </h4>

        {/* 全体統計サマリー */}
        <div style={{
          backgroundColor: '#f8fafc',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem'
        }}>
          <h5 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem' }}>
            📊 統計サマリー
          </h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#3b82f6', fontWeight: 'bold' }}>{historyData.length}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>総回答セッション</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#10b981', fontWeight: 'bold' }}>{tendencyNames.length}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>分析対象傾向</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#f59e0b', fontWeight: 'bold' }}>
                {(() => {
                  const dates = historyData.map(s => new Date(s.session.response_date));
                  const latest = new Date(Math.max(...dates.map(d => d.getTime())));
                  const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
                  const daysDiff = Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
                  return daysDiff;
                })()}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>追跡期間（日）</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: '#8b5cf6', fontWeight: 'bold' }}>
                {(() => {
                  let improvingCount = 0;
                  tendencyNames.forEach((name: any) => {
                    const stats = calculateTendencyStatistics(historyData, name);
                    if (stats.trend === 'increasing') improvingCount++;
                  });
                  return improvingCount;
                })()}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>改善傾向の項目</div>
            </div>
          </div>
        </div>

        {/* 傾向別履歴グラフ */}
        <div style={{ display: 'grid', gap: '2rem' }}>
          {tendencyNames.map((tendencyName: string) => {
            const tendencyData = historyData[0].tendencyAnalysis.find((t: any) => t.tendency_name === tendencyName);
            const stats = calculateTendencyStatistics(historyData, tendencyName);
            
            return (
              <div key={tendencyName} style={{
                backgroundColor: '#f9fafb',
                padding: '1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h6 style={{ margin: '0 0 0.25rem 0', color: '#374151', fontSize: '1rem', fontWeight: 'bold' }}>
                    {tendencyName}
                  </h6>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                    {tendencyData?.tendency_description}
                  </p>
                  
                  {/* トレンド指標 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem' }}>
                    <div style={{
                      backgroundColor: stats.trend === 'increasing' ? '#dcfce7' : 
                                     stats.trend === 'decreasing' ? '#fef2f2' : '#f3f4f6',
                      color: stats.trend === 'increasing' ? '#065f46' : 
                            stats.trend === 'decreasing' ? '#991b1b' : '#374151',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontWeight: '600'
                    }}>
                      {stats.trend === 'increasing' ? '📈 向上傾向' : 
                       stats.trend === 'decreasing' ? '📉 低下傾向' : '➡️ 安定'}
                    </div>
                    <div style={{ color: '#6b7280' }}>
                      平均: {stats.mean.toFixed(1)}%
                    </div>
                    <div style={{ color: '#6b7280' }}>
                      範囲: {stats.min.toFixed(1)}% - {stats.max.toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                {/* スコア推移グラフ（折れ線グラフ） */}
                <div style={{
                  backgroundColor: 'white',
                  padding: '1.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  marginBottom: '1rem'
                }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <h6 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                      📈 スコア推移（折れ線グラフ）
                    </h6>
                  </div>
                  
                  <div style={{ position: 'relative', height: '300px', width: '100%' }}>
                    <svg
                      width="100%"
                      height="300"
                      style={{ overflow: 'visible' }}
                      viewBox="0 0 600 300"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {/* グリッドライン */}
                      {[0, 25, 50, 75, 100].map((percentage) => {
                        const y = 270 - (percentage / 100) * 240;
                        return (
                          <g key={percentage}>
                            <line
                              x1="50"
                              y1={y}
                              x2="550"
                              y2={y}
                              stroke="#f3f4f6"
                              strokeWidth="1"
                            />
                            <text
                              x="45"
                              y={y + 4}
                              fontSize="12"
                              fill="#9ca3af"
                              textAnchor="end"
                            >
                              {percentage}%
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* 平均線 */}
                      <line
                        x1="50"
                        y1={270 - (stats.mean / 100) * 240}
                        x2="550"
                        y2={270 - (stats.mean / 100) * 240}
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                        opacity="0.7"
                      />
                      <text
                        x="555"
                        y={270 - (stats.mean / 100) * 240 + 4}
                        fontSize="11"
                        fill="#f59e0b"
                        fontWeight="bold"
                      >
                        平均 {stats.mean.toFixed(1)}%
                      </text>
                      
                      {/* 折れ線 */}
                      {historyData.length > 1 && (
                        <polyline
                          points={historyData.map((sessionData: any, index: number) => {
                            const tendency = sessionData.tendencyAnalysis.find((t: any) => t.tendency_name === tendencyName);
                            const percentage = tendency ? tendency.percentage : 0;
                            const x = 50 + (index / (historyData.length - 1)) * 500;
                            const y = 270 - (percentage / 100) * 240;
                            return `${x},${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      )}
                      
                      {/* データポイント */}
                      {historyData.map((sessionData: any, index: number) => {
                        const tendency = sessionData.tendencyAnalysis.find((t: any) => t.tendency_name === tendencyName);
                        const percentage = tendency ? tendency.percentage : 0;
                        const x = historyData.length === 1 ? 300 : 50 + (index / (historyData.length - 1)) * 500;
                        const y = 270 - (percentage / 100) * 240;
                        
                        // 前回からの変化
                        const prevSession = index > 0 ? historyData[index - 1] : null;
                        const prevTendency = prevSession ? 
                          prevSession.tendencyAnalysis.find((t: any) => t.tendency_name === tendencyName) : null;
                        const change = prevTendency ? percentage - prevTendency.percentage : null;
                        
                        const isLatest = index === historyData.length - 1;
                        const pointColor = isLatest ? '#ef4444' : 
                                         change && change > 0 ? '#10b981' :
                                         change && change < 0 ? '#ef4444' : '#3b82f6';
                        
                        return (
                          <g key={index}>
                            {/* データポイント */}
                            <circle
                              cx={x}
                              cy={y}
                              r={isLatest ? "6" : "4"}
                              fill={pointColor}
                              stroke="white"
                              strokeWidth="2"
                            />
                            
                            {/* 値表示 */}
                            <text
                              x={x}
                              y={y - 15}
                              fontSize="11"
                              fill="#374151"
                              textAnchor="middle"
                              fontWeight="bold"
                            >
                              {percentage.toFixed(1)}%
                            </text>
                            
                            {/* 回数表示 */}
                            <text
                              x={x}
                              y={285}
                              fontSize="10"
                              fill="#6b7280"
                              textAnchor="middle"
                            >
                              {sessionData.sessionNumber}回
                            </text>
                            
                            {/* 変化表示 */}
                            {change !== null && Math.abs(change) >= 1 && (
                              <text
                                x={x}
                                y={y + (change > 0 ? -25 : 20)}
                                fontSize="10"
                                fill={change > 0 ? '#10b981' : '#ef4444'}
                                textAnchor="middle"
                                fontWeight="bold"
                              >
                                {change > 0 ? '▲' : '▼'}{Math.abs(change).toFixed(1)}%
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* 統計詳細 */}
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <h6 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                      📊 統計指標
                    </h6>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '0',
                    fontSize: '0.75rem'
                  }}>
                    <div style={{ padding: '0.75rem', borderRight: '1px solid #f3f4f6' }}>
                      <div style={{ color: '#6b7280' }}>平均値</div>
                      <div style={{ fontWeight: 'bold', color: '#374151' }}>{stats.mean.toFixed(1)}%</div>
                    </div>
                    <div style={{ padding: '0.75rem', borderRight: '1px solid #f3f4f6' }}>
                      <div style={{ color: '#6b7280' }}>中央値</div>
                      <div style={{ fontWeight: 'bold', color: '#374151' }}>{stats.median.toFixed(1)}%</div>
                    </div>
                    <div style={{ padding: '0.75rem', borderRight: '1px solid #f3f4f6' }}>
                      <div style={{ color: '#6b7280' }}>標準偏差</div>
                      <div style={{ fontWeight: 'bold', color: '#374151' }}>{stats.standardDeviation.toFixed(1)}%</div>
                    </div>
                    <div style={{ padding: '0.75rem', borderRight: '1px solid #f3f4f6' }}>
                      <div style={{ color: '#6b7280' }}>最小値</div>
                      <div style={{ fontWeight: 'bold', color: '#ef4444' }}>{stats.min.toFixed(1)}%</div>
                    </div>
                    <div style={{ padding: '0.75rem', borderRight: '1px solid #f3f4f6' }}>
                      <div style={{ color: '#6b7280' }}>最大値</div>
                      <div style={{ fontWeight: 'bold', color: '#10b981' }}>{stats.max.toFixed(1)}%</div>
                    </div>
                    <div style={{ padding: '0.75rem' }}>
                      <div style={{ color: '#6b7280' }}>変動幅</div>
                      <div style={{ fontWeight: 'bold', color: '#374151' }}>{stats.range.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
                {/* 詳細データテーブル */}
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: '0.75rem',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <h6 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                      📋 詳細履歴データ
                    </h6>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                          回数
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                          回答日
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                          スコア
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                          割合
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                          回答率
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                          前回比
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((sessionData: any, index: number) => {
                        const tendencyCurrentData = sessionData.tendencyAnalysis.find((t: any) => t.tendency_name === tendencyName);
                        const prevSessionData = index > 0 ? historyData[index - 1] : null;
                        const tendencyPrevData = prevSessionData ? 
                          prevSessionData.tendencyAnalysis.find((t: any) => t.tendency_name === tendencyName) : null;
                        
                        const scoreDiff = tendencyPrevData ? 
                          (tendencyCurrentData?.total_score || 0) - tendencyPrevData.total_score : null;
                        const percentageDiff = tendencyPrevData ? 
                          (tendencyCurrentData?.percentage || 0) - tendencyPrevData.percentage : null;

                        return (
                          <tr key={index} style={{ 
                            borderBottom: '1px solid #f3f4f6',
                            backgroundColor: index === historyData.length - 1 ? '#eff6ff' : 'white'
                          }}>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                              {sessionData.sessionNumber}回目
                              {index === historyData.length - 1 && (
                                <span style={{ 
                                  marginLeft: '0.5rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  padding: '0.125rem 0.375rem',
                                  borderRadius: '0.25rem'
                                }}>
                                  最新
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                              {formatDateTime(sessionData.session.response_date)}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: '500' }}>
                              {tendencyCurrentData?.total_score || 0} / {tendencyCurrentData?.max_possible_score || 0}点
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem' }}>
                              <div style={{ fontWeight: '600', color: '#374151' }}>
                                {tendencyCurrentData?.percentage.toFixed(1) || '0.0'}%
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem' }}>
                              {tendencyCurrentData?.coverage.toFixed(1) || '0.0'}%
                              <br />
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                ({tendencyCurrentData?.answered_count || 0}/{tendencyCurrentData?.question_count || 0})
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.875rem' }}>
                              {scoreDiff !== null ? (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  gap: '0.25rem'
                                }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}>
                                    <span style={{
                                      fontSize: '1rem',
                                      color: scoreDiff > 0 ? '#059669' : scoreDiff < 0 ? '#dc2626' : '#6b7280'
                                    }}>
                                      {scoreDiff > 0 ? '📈' : scoreDiff < 0 ? '📉' : '➡️'}
                                    </span>
                                    <span style={{
                                      color: scoreDiff > 0 ? '#059669' : scoreDiff < 0 ? '#dc2626' : '#6b7280',
                                      fontWeight: '600',
                                      fontSize: '0.9rem'
                                    }}>
                                      {scoreDiff > 0 ? '+' : ''}{scoreDiff}点
                                    </span>
                                  </div>
                                  {percentageDiff !== null && (
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem'
                                    }}>
                                      <span style={{
                                        backgroundColor: percentageDiff > 0 ? '#dcfce7' : percentageDiff < 0 ? '#fef2f2' : '#f3f4f6',
                                        color: percentageDiff > 0 ? '#065f46' : percentageDiff < 0 ? '#991b1b' : '#374151',
                                        padding: '0.125rem 0.375rem',
                                        borderRadius: '0.25rem',
                                        fontSize: '0.75rem',
                                        fontWeight: '600'
                                      }}>
                                        {percentageDiff > 0 ? '+' : ''}{percentageDiff.toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '1rem' }}>➖</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    loadData();
  }, []);


  if (loading) {
    return (
      <div className="answer-root">
        <h1 className="answer-title">回答集計</h1>
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
        <h1 className="answer-title" style={{ margin: 0 }}>回答集計</h1>
      </div>

      {/* 表示モード選択タブ */}
      <div style={{
        backgroundColor: '#f3f4f6',
        padding: '1rem',
        borderRadius: '0.5rem',
        marginBottom: '1.5rem',
        border: '1px solid #d1d5db'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setViewMode('overview')}
            style={{
              backgroundColor: viewMode === 'overview' ? '#3b82f6' : '#e5e7eb',
              color: viewMode === 'overview' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            概要
          </button>
          <button
            onClick={() => setViewMode('user-stats')}
            style={{
              backgroundColor: viewMode === 'user-stats' ? '#3b82f6' : '#e5e7eb',
              color: viewMode === 'user-stats' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            ユーザー別統計
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            style={{
              backgroundColor: viewMode === 'comparison' ? '#3b82f6' : '#e5e7eb',
              color: viewMode === 'comparison' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '0.25rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            変化比較
          </button>
        </div>

        {/* フィルター */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#374151' }}>
              問題セット選択
            </label>
            <select
              value={selectedProblemSet || ''}
              onChange={(e) => setSelectedProblemSet(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            >
              <option value="">すべての問題セット</option>
              {problemSets.map((problemSet) => (
                <option key={problemSet.id} value={problemSet.id}>
                  {problemSet.name}
                </option>
              ))}
            </select>
          </div>
          
          {(viewMode === 'user-stats' || viewMode === 'comparison') && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', color: '#374151' }}>
                ユーザー選択
              </label>
              <select
                value={selectedUser || ''}
                onChange={(e) => setSelectedUser(e.target.value ? Number(e.target.value) : null)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.25rem',
                  border: '1px solid #d1d5db',
                  fontSize: '0.875rem'
                }}
              >
                <option value="">すべてのユーザー</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 集計結果表示エリア */}
      {viewMode === 'overview' && renderOverviewSection()}
      {viewMode === 'user-stats' && renderUserStatsSection()}
      {viewMode === 'comparison' && renderComparisonSection()}

      {/* 回答セッション一覧 */}
      {viewMode === 'overview' && responseSessions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#374151', marginBottom: '1rem' }}>
            回答セッション一覧
          </h3>
          
          {(() => {
            const filteredSessions = responseSessions.filter(session => 
              !selectedProblemSet || session.problem_set_id === selectedProblemSet
            );
            
            const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const currentSessions = filteredSessions.slice(startIndex, endIndex);
            
            return (
              <>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                          回答者
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                          問題セット
                        </th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                          回答日
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSessions.map((session) => (
                        <tr key={session.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.75rem' }}>
                            {session.user_name}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {session.problem_set_name}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {formatDateTime(session.response_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* ページ情報とページネーション */}
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    marginTop: '1.5rem'
                  }}>
                    {/* 表示件数情報 */}
                    <div style={{
                      backgroundColor: 'white',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#374151',
                        fontWeight: '500'
                      }}>
                        全{filteredSessions.length}件中 {startIndex + 1}〜{Math.min(endIndex, filteredSessions.length)}件を表示
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        backgroundColor: '#f3f4f6',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        border: '1px solid #d1d5db'
                      }}>
                        ページ {currentPage} / {totalPages}
                      </div>
                    </div>
                    
                    {/* ページネーションコントロール */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: 'white',
                      padding: '1.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #e5e7eb'
                    }}>
                      {/* 最初のページボタン */}
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        style={{
                          backgroundColor: currentPage === 1 ? '#f9fafb' : 'white',
                          color: currentPage === 1 ? '#9ca3af' : '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          padding: '0.5rem',
                          fontSize: '0.875rem',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          minWidth: '2.5rem',
                          height: '2.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: currentPage === 1 ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== 1) {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.borderColor = '#9ca3af';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== 1) {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#d1d5db';
                          }
                        }}
                      >
                        ⟪
                      </button>
                      
                      {/* 前のページボタン */}
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        style={{
                          backgroundColor: currentPage === 1 ? '#f9fafb' : 'white',
                          color: currentPage === 1 ? '#9ca3af' : '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.875rem',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          height: '2.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: currentPage === 1 ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== 1) {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.borderColor = '#9ca3af';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== 1) {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#d1d5db';
                          }
                        }}
                      >
                        ← 前
                      </button>
                      
                      {/* ページ番号ボタン */}
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // 現在のページ周辺のページ番号のみ表示
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 2 && page <= currentPage + 2)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                style={{
                                  backgroundColor: currentPage === page ? '#3b82f6' : 'white',
                                  color: currentPage === page ? 'white' : '#374151',
                                  border: `1px solid ${currentPage === page ? '#3b82f6' : '#d1d5db'}`,
                                  borderRadius: '0.375rem',
                                  padding: '0.5rem',
                                  fontSize: '0.875rem',
                                  cursor: 'pointer',
                                  minWidth: '2.5rem',
                                  height: '2.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: currentPage === page ? '600' : '400',
                                  transition: 'all 0.2s ease',
                                  boxShadow: currentPage === page ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                }}
                                onMouseEnter={(e) => {
                                  if (currentPage !== page) {
                                    e.currentTarget.style.backgroundColor = '#eff6ff';
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                    e.currentTarget.style.color = '#3b82f6';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (currentPage !== page) {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                    e.currentTarget.style.color = '#374151';
                                  }
                                }}
                              >
                                {page}
                              </button>
                            );
                          } else if (
                            (page === currentPage - 3 && currentPage > 4) ||
                            (page === currentPage + 3 && currentPage < totalPages - 3)
                          ) {
                            return (
                              <div
                                key={page}
                                style={{
                                  padding: '0.5rem',
                                  fontSize: '0.875rem',
                                  color: '#9ca3af',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '2.5rem',
                                  height: '2.5rem'
                                }}
                              >
                                ⋯
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                      
                      {/* 次のページボタン */}
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                          backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white',
                          color: currentPage === totalPages ? '#9ca3af' : '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.875rem',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          height: '2.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: currentPage === totalPages ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== totalPages) {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.borderColor = '#9ca3af';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== totalPages) {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#d1d5db';
                          }
                        }}
                      >
                        次 →
                      </button>
                      
                      {/* 最後のページボタン */}
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        style={{
                          backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white',
                          color: currentPage === totalPages ? '#9ca3af' : '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          padding: '0.5rem',
                          fontSize: '0.875rem',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          minWidth: '2.5rem',
                          height: '2.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: currentPage === totalPages ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage !== totalPages) {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.borderColor = '#9ca3af';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== totalPages) {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#d1d5db';
                          }
                        }}
                      >
                        ⟫
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* 質問詳細モーダル */}
      {renderQuestionDetailsModal()}
    </div>
  );
};

export default ResponseAggregationPage;
