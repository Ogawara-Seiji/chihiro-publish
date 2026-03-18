import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

interface Question {
  id: number;
  question: string;
  question_type?: string;
}

interface Answer {
  id: number;
  question_id: number;
  answer_index: number;
  text: string;
  tendency_id: number;
  weight: number;
}

interface UserResponseData {
  answer_id: number;
  tendency_id: number;
  weight: number;
}

interface UserResponse {
  question_id: number;
  answer_id: number;
  score?: number;
  tendency_id?: number;
}

const ResponsePage: React.FC = () => {
  const navigate = useNavigate();
  const { userId, problemSetId } = useParams<{ userId: string; problemSetId: string }>();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [userResponses, setUserResponses] = useState<{ [questionId: number]: UserResponseData }>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !problemSetId) {
      alert('ユーザーIDまたは問題セットIDが指定されていません');
      navigate('/user-select');
      return;
    }

    loadQuestions();
  }, [userId, problemSetId, navigate]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      console.log('Loading questions for problemSetId:', problemSetId);
      
      // 問題セットに含まれる質問を取得
      const questionsResult = await invoke<any[]>('get_questions', {
        problemSetId: Number(problemSetId)
      });
      console.log('Questions loaded:', questionsResult);
      console.log('Questions count:', questionsResult.length);
      console.log('First question structure:', questionsResult[0]);
      
      // Rustの構造体からTypeScriptのインターフェースにマッピング
      const mappedQuestions: Question[] = questionsResult.map(q => ({
        id: q.id,
        question: q.text, // textフィールドをquestionにマッピング
        question_type: q.question_type || 'choice'
      }));
      
      setQuestions(mappedQuestions);

      // すべての回答を取得
      const answersResult = await invoke<Answer[]>('get_answers', {
        problemSetId: Number(problemSetId)
      });
      console.log('Answers loaded:', answersResult);
      console.log('Answers count:', answersResult.length);
      setAnswers(answersResult);
      
    } catch (error) {
      console.error('データの読み込みに失敗しました:', error);
      alert(`データの読み込みに失敗しました: ${error}`);
      navigate(`/problem-select/${userId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, selectedAnswer: Answer) => {
    // 回答を記録
    const newResponses = {
      ...userResponses,
      [questionId]: {
        answer_id: selectedAnswer.id,
        tendency_id: selectedAnswer.tendency_id,
        weight: selectedAnswer.weight
      }
    };
    setUserResponses(newResponses);

    // 少し遅延を入れてから次の処理（視覚的フィードバックのため）
    setTimeout(() => {
      // 自動で次の問題に進む（最終問題以外）
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      }
      // 最終問題の場合は、そのまま留まって完了ボタンを表示
    }, 300);
  };

  const handleQuizComplete = async () => {
    try {
      // ユーザーの回答を保存
      const responses: UserResponse[] = Object.entries(userResponses).map(([questionId, response]) => ({
        question_id: Number(questionId),
        answer_id: response.answer_id,
        score: response.weight,
        tendency_id: response.tendency_id
      }));

      await invoke('save_user_responses', {
        userId: Number(userId),
        problemSetId: Number(problemSetId),
        responses
      });

      // 完了ダイアログ表示
      alert('回答が完了しました！結果を確認します。');
      
      // 結果画面に遷移
      navigate(`/result/${userId}/${problemSetId}`);
      
    } catch (error) {
      console.error('回答の保存に失敗しました:', error);
      alert('回答の保存に失敗しました');
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const getCurrentAnswers = (questionId: number): Answer[] => {
    return answers.filter(a => a.question_id === questionId);
  };

  const goBack = () => {
    if (confirm('回答を破棄して戻りますか？')) {
      navigate(`/problem-select?userId=${userId}`);
    }
  };

  if (loading) {
    return (
      <div className="quiz-container">
        <div className="quiz-card text-center">
          <div className="text-lg">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="quiz-container">
        <div className="quiz-card text-center">
          <h1 className="text-2xl font-bold mb-4">エラー</h1>
          <p className="text-gray-600 mb-6">この問題セットには質問が含まれていません</p>
          <button
            onClick={goBack}
            className="retry-btn"
          >
            問題選択に戻る
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  
  // 現在の質問が存在しない場合の安全性チェック
  if (!currentQuestion) {
    return (
      <div className="quiz-container">
        <div className="quiz-card text-center">
          <h1 className="text-2xl font-bold mb-4">エラー</h1>
          <p className="text-gray-600 mb-6">質問データが見つかりません</p>
          <button
            onClick={goBack}
            className="retry-btn"
          >
            問題選択に戻る
          </button>
        </div>
      </div>
    );
  }
  
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(userResponses).length;
  const isAllAnswered = answeredCount === questions.length;

  return (
    <div className="response-container">
      {/* コンパクトなヘッダー */}
      <div className="response-compact-header">
        <button
          onClick={goBack}
          className="compact-back-btn"
        >
          ← 戻る
        </button>
        
        <div className="compact-progress">
          <span className="progress-text-small">{currentQuestionIndex + 1} / {questions.length}</span>
          <span className={`answered-count ${isAllAnswered ? 'complete' : ''}`}>
            回答済み: {answeredCount} / {questions.length}
            {isAllAnswered && " ✅"}
          </span>
          <div className="progress-bar-small">
            <div 
              className={`progress-fill-small ${isAllAnswered ? 'complete' : ''}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* メインクイズカード - より大きく目立つように */}
      <div className="response-main-card">
        <div className="question-content-main">
          <h1 className="question-text-main">
            {currentQuestion.question || "質問が読み込まれていません"}
          </h1>
        </div>

        <div className="choices-section-main">
          <div className="choices-grid-main">
            {getCurrentAnswers(currentQuestion.id).map((answer, index) => {
              const choiceLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
              const label = choiceLabels[index] || (index + 1).toString();
              const currentAnswer = userResponses[currentQuestion.id];
              const isSelected = currentAnswer?.answer_id === answer.id;
              
              return (
                <button
                  key={answer.id}
                  onClick={() => handleAnswerChange(currentQuestion.id, answer)}
                  className={`choice-btn-main ${isSelected ? 'selected' : ''}`}
                >
                  <div className="choice-label-main">{label}</div>
                  <div className="choice-text-main">{answer.text}</div>
                  {isSelected && <div className="choice-check">✓</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* シンプルなナビゲーション */}
        <div className="navigation-simple">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className={`nav-btn-simple prev ${currentQuestionIndex === 0 ? 'disabled' : ''}`}
          >
            ← 前へ
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            // 最終問題の場合
            isAllAnswered ? (
              <button
                onClick={handleQuizComplete}
                className="nav-btn-simple complete"
              >
                結果を見る 🎯
              </button>
            ) : (
              <div className="completion-simple incomplete">
                残り {questions.length - answeredCount} 問に回答してください
              </div>
            )
          ) : (
            // 最終問題以外の場合
            <button
              onClick={handleNext}
              className="nav-btn-simple next"
            >
              次へ →
            </button>
          )}
        </div>
      </div>

      {/* 質問ナビゲーション - 小さく下部に */}
      <div className="question-nav-bottom">
        <div className="nav-dots">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`nav-dot ${
                index === currentQuestionIndex
                  ? 'current'
                  : userResponses[questions[index].id]
                  ? 'answered'
                  : 'unanswered'
              }`}
              title={`質問 ${index + 1}`}
            >
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResponsePage;