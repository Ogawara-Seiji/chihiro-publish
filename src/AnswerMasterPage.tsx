import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useParams } from "react-router-dom";
import "./AnswerMasterPage.css";

/* ---------- 型 ---------- */
export type BaseCard = { id?: number; index: number; text: string };
export type QCard = BaseCard;
export type ACard = BaseCard & {
  tendency_id: number | null; // ▼ number → number | null
  weight: string;             // ▼ number → string
};

/* ---------- QA グループ ---------- */
export type QAGroup = {
  q: QCard;
  a: ACard[];
};

/* ---------- 定数 ---------- */
const Q_MAX = 20; // 質問最大数
const A_MIN = 1; // 回答最小 (1つは必須)
const A_MAX = 10; // 回答最大

/* -------------------------------------------------------------- */
const AnswerMasterPage: React.FC = () => {
  /* ---- URL から問題セット ID ---- */
  const { setId } = useParams();
  const problemSetId = Number(setId) || 0;

  /* ---- State ---- */
  const [groups, setGroups] = useState<QAGroup[]>([]);
  const [toastIdx, setToastIdx] = useState<number | null>(null);
  const [tendencies, setTendencies] = useState<{ id: number; name: string }[]>([]);
  const [problemSetName, setProblemSetName] = useState<string>("");
  const [problemSetDescription, setProblemSetDescription] = useState<string>("");
  const [resultSetId, setResultSetId] = useState<number | null>(null);
  const [resultSets, setResultSets] = useState<{ id: number; name: string; description: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isEditingSetInfo, setIsEditingSetInfo] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    type: 'link' | 'browser';
    href?: string;
    callback?: () => void;
  } | null>(null);
  const [originalData, setOriginalData] = useState<{
    groups: QAGroup[];
    setName: string;
    setDescription: string;
    resultSetId: number | null;
  } | null>(null);

  /* ---- Util ---- */
  // データが変更されているかチェック
  const checkForChanges = () => {
    if (!originalData) return false;
    
    const currentData = {
      groups,
      setName: problemSetName,
      setDescription: problemSetDescription,
      resultSetId,
    };
    
    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  };

  // 元データを更新
  const updateOriginalData = () => {
    setOriginalData({
      groups: JSON.parse(JSON.stringify(groups)),
      setName: problemSetName,
      setDescription: problemSetDescription,
      resultSetId,
    });
    setHasUnsavedChanges(false);
  };

  const padAnswers = (list: ACard[]): ACard[] => {
    const filled = [
      ...list,
      ...Array.from({ length: Math.max(A_MIN - list.length, 0) }).map(
        (_, i) =>
          ({
            index: list.length + i + 1,
            text: "",
            tendency_id: null, // ▼ 1 → null
            weight: "1",       // ▼ 1 → "1"
          } as ACard)
      ),
    ];
    return filled.slice(0, A_MAX).map((a, i) => ({ ...a, index: i + 1 }));
  };

  /* ---- 初期ロード ---- */
  const loadResultSets = async () => {
    try {
      const data = await invoke<{ id: number; name: string; description: string }[]>("list_result_sets");
      setResultSets(data);
    } catch (error) {
      console.error("結果セットの取得に失敗:", error);
    }
  };

  const loadProblemSetName = async () => {
    try {
      const setInfo = await invoke<{ name: string; description: string; result_set_id: number | null }>("get_problem_set", {
        id: problemSetId,
      });
      setProblemSetName(setInfo.name);
      setProblemSetDescription(setInfo.description);
      setResultSetId(setInfo.result_set_id);
    } catch (error) {
      setProblemSetName("問題セット");
      setProblemSetDescription("");
      setResultSetId(null);
    }
  };

  const loadGroups = async () => {
    // 質問一覧
    const qs = await invoke<QCard[]>("list_questions", {
      problemSetId,
    });
    
    // 質問をIDで並び替え（作成順）
    const sortedQs = qs.sort((a, b) => (a.id || 0) - (b.id || 0));
    
    // 各質問に回答を付与
    const g = await Promise.all(
      sortedQs.map(async (q, i) => {
        const as = await invoke<any[]>("list_answers", { questionId: q.id });
        // answers API から tendency_id と weight が来るはず
        
        return {
          q: { ...q, index: i + 1 }, // 正しい順序でindexを設定
          a: padAnswers(
            as.map(a => ({
              id: a.id,
              index: a.answer_index,
              text: a.text,
              tendency_id: a.tendency_id ?? null,
              weight: String(a.weight ?? 1),
            }))
          ),
        } as QAGroup;
      })
    );
    // 0 件なら空 1 グループ
    const newGroups = g.length ? g : [{ q: { index: 1, text: "" }, a: padAnswers([]) }];
    setGroups(newGroups);
    
    // 初期データとして保存
    setTimeout(() => {
      updateOriginalData();
    }, 100);
  };

  useEffect(() => {
    // 傾向マスター取得
    invoke<{ id: number; name: string }[]>("list_tendencies").then(setTendencies);
    // 結果セット一覧取得
    loadResultSets();
    // 問題セット名取得
    loadProblemSetName();
    // グループロード
    loadGroups();
  }, []);

  // 変更検知
  useEffect(() => {
    const hasChanges = checkForChanges();
    console.log('Change detection:', { hasChanges, originalData: !!originalData, groups: groups.length });
    setHasUnsavedChanges(hasChanges);
  }, [groups, problemSetName, problemSetDescription, resultSetId, originalData]);

  // ページ離脱時の確認
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    // リンククリック時の確認
    const handleLinkClick = (e: MouseEvent) => {
      console.log('Link click detected, hasUnsavedChanges:', hasUnsavedChanges);
      if (hasUnsavedChanges) {
        const target = e.target as HTMLElement;
        const link = target.closest('a');
        console.log('Link found:', link?.href);
        if (link && link.href && !link.href.includes('#')) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Preventing navigation to:', link.href);
          setPendingNavigation({ type: 'link', href: link.href });
          setShowConfirmModal(true);
        }
      }
    };

    // ブラウザの戻る/進むボタン時の確認
    const handlePopState = () => {
      if (hasUnsavedChanges) {
        // ブラウザナビゲーションを一時停止
        window.history.pushState(null, '', window.location.href);
        setPendingNavigation({ 
          type: 'browser', 
          callback: () => window.history.back() 
        });
        setShowConfirmModal(true);
      }
    };

    // 初期状態をプッシュ（戻るボタン検知のため）
    if (hasUnsavedChanges) {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleLinkClick, true); // capture phase
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleLinkClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges]);

  // 確認モーダルのハンドラ
  const handleConfirmLeave = () => {
    if (pendingNavigation) {
      if (pendingNavigation.type === 'link' && pendingNavigation.href) {
        // 未保存フラグをクリアしてからナビゲーション
        setHasUnsavedChanges(false);
        setTimeout(() => {
          window.location.href = pendingNavigation.href!;
        }, 0);
      } else if (pendingNavigation.type === 'browser' && pendingNavigation.callback) {
        setHasUnsavedChanges(false);
        setTimeout(() => {
          pendingNavigation.callback!();
        }, 0);
      }
    }
    setShowConfirmModal(false);
    setPendingNavigation(null);
  };

  const handleCancelLeave = () => {
    setShowConfirmModal(false);
    setPendingNavigation(null);
    // 入力内容はそのまま保持される
  };

  /* ---------------- 編集ハンドラ ---------------- */
  const editQuestion = (gIdx: number, text: string) => {
    console.log('Editing question:', gIdx, text);
    setGroups((prev) =>
      prev.map((g, i) => (i === gIdx ? { ...g, q: { ...g.q, text } } : g))
    );
  };

  const editAnswer = (gIdx: number, aIdx: number, text: string) => {
    console.log('Editing answer:', gIdx, aIdx, text);
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx
          ? {
              ...g,
              a: g.a.map((a, j) => (j === aIdx ? { ...a, text } : a)),
            }
          : g
      )
    );
  };

  const editAnswerTendency = (gIdx: number, aIdx: number, tendency_id: number | null) =>
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx
          ? {
              ...g,
              a: g.a.map((a, j) => (j === aIdx ? { ...a, tendency_id } : a)),
            }
          : g
      )
    );

  const editAnswerWeight = (gIdx: number, aIdx: number, weight: string) =>
    setGroups(prev =>
      prev.map((g, i) =>
        i === gIdx
          ? { ...g, a: g.a.map((a, j) => (j === aIdx ? { ...a, weight } : a)) }
          : g
      )
    );

  /* ---- 回答追加／削除 ---- */
  const addAnswer = (gIdx: number) =>
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx && g.a.length < A_MAX
          ? {
              ...g,
              a: [
                ...g.a,
                {
                  index: g.a.length + 1,
                  text: "",
                  tendency_id: null,
                  weight: "1",
                },
              ],
            }
          : g
      )
    );

  const deleteAnswer = (gIdx: number, aIdx: number) =>
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx
          ? {
              ...g,
              a: g.a
                .filter((_, j) => j !== aIdx)
                .map((a, j) => ({ ...a, index: j + 1 })),
            }
          : g
      )
    );

  /* ---- グループ操作 ---- */
  const addGroup = () =>
    setGroups((prev) =>
      prev.length >= Q_MAX
        ? prev
        : [
            ...prev,
            { 
              q: { index: prev.length + 1, text: "" }, 
              a: padAnswers([]) 
            },
          ]
    );

  const deleteGroup = async (gIdx: number) => {
    const g = groups[gIdx];
    if (!g) return;

    // 確認ダイアログ
    const confirmMessage = g.q.id 
      ? "この質問を削除しますか？データベースからも削除されます。"
      : "この質問を削除しますか？";
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // データベースから削除（質問IDがある場合のみ）
    if (g.q.id) {
      try {
        await invoke("delete_question", { id: g.q.id });
        // 削除成功後、データを再読み込み
        await loadGroups();
        // 成功のトースト表示
        setToastIdx(-2); // 特別な値で削除完了を示す
        setTimeout(() => setToastIdx(null), 2000);
      } catch (error) {
        setErrors(["質問の削除に失敗しました"]);
      }
    } else {
      // 新規作成中の質問（IDがない）はstateからのみ削除し、indexを再計算
      setGroups((prev) => 
        prev
          .filter((_, i) => i !== gIdx)
          .map((group, i) => ({
            ...group,
            q: { ...group.q, index: i + 1 }
          }))
      );
    }
  };

  /* ---------------- バリデーション ---------------- */
  const validateGroup = (g: QAGroup): string[] => {
    const errors: string[] = [];
    
    // 質問が空の場合
    if (!g.q.text.trim()) {
      errors.push("質問を入力してください");
    }
    
    // 回答が1つもない場合
    const validAnswers = g.a.filter(a => a.text.trim());
    if (validAnswers.length === 0) {
      errors.push("少なくとも1つの回答を入力してください");
    }
    
    // 入力された回答に傾向が選択されていない場合
    validAnswers.forEach((a) => {
      if (a.tendency_id === null) {
        errors.push(`回答${a.index}の傾向を選択してください`);
      }
    });
    
    return errors;
  };

  /* ---------------- 保存 ---------------- */
  const saveAll = async () => {
    // 全グループのバリデーション
    const allErrors: string[] = [];
    groups.forEach((g, idx) => {
      const groupErrors = validateGroup(g);
      if (groupErrors.length > 0) {
        allErrors.push(`質問${idx + 1}: ${groupErrors.join(', ')}`);
      }
    });

    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }

    // エラークリア
    setErrors([]);

    try {
      const tasks: Promise<unknown>[] = [];

      // セット情報の保存
      if (isEditingSetInfo) {
        tasks.push(
          invoke("update_problem_set", {
            id: problemSetId,
            name: problemSetName.trim(),
            description: problemSetDescription.trim(),
            resultSetId: resultSetId,
          })
        );
      }

      // 各グループの保存
      for (const g of groups) {
        const qText = g.q.text.trim();

        if (!g.q.id && qText) {
          // 新規質問追加
          tasks.push(
            invoke<number>("add_question", {
              problemSetId,
              text: qText,
            }).then(async (newId) => {
              await Promise.all(
                g.a
                  .filter((a) => a.text.trim())
                  .map((a) =>
                    invoke("add_answer", {
                      questionId: newId,
                      answerIndex: a.index,
                      text: a.text.trim(),
                      tendencyId: a.tendency_id,
                      weight: parseInt(a.weight) || 1,
                    })
                  )
              );
            })
          );
        } else if (g.q.id) {
          if (qText) {
            tasks.push(invoke("update_question", { id: g.q.id, text: qText }));
          } else {
            tasks.push(invoke("delete_question", { id: g.q.id }));
          }

          // 既存質問の回答処理
          g.a.forEach((a) => {
            const body = {
              questionId: g.q.id,
              answerIndex: a.index,
              text: a.text.trim(),
              tendencyId: a.tendency_id,
              weight: parseInt(a.weight) || 1,
            };
            if (!a.id && body.text) tasks.push(invoke("add_answer", body));
            if (a.id) {
              if (body.text) {
                tasks.push(
                  invoke("update_answer", {
                    id: a.id,
                    answerIndex: body.answerIndex,
                    text: body.text,
                    tendencyId: body.tendencyId,
                    weight: body.weight,
                  })
                );
              } else {
                tasks.push(invoke("delete_answer", { id: a.id }));
              }
            }
          });
        }
      }

      await Promise.all(tasks);
      
      // セット編集モードを終了
      setIsEditingSetInfo(false);
      
      // データ再読み込み
      await loadGroups();
      
      // 成功のトースト表示
      setToastIdx(-3); // 全体保存完了
      setTimeout(() => setToastIdx(null), 2000);
      
    } catch (error) {
      setErrors(["保存に失敗しました"]);
    }
  };

  /* ---------------- セット情報編集 ---------------- */
  const cancelSetInfoEdit = () => {
    loadProblemSetName(); // 元の値に戻す
    setIsEditingSetInfo(false);
  };

  /* -------------------------------------------------- 画面 */
  return (
    <div className="answer-root">
      {/* デバッグ情報 (開発用) */}
      <div style={{ 
        position: 'fixed', 
        top: '10px', 
        right: '10px', 
        background: 'rgba(0,0,0,0.8)', 
        color: 'white', 
        padding: '10px', 
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 9999 
      }}>
        変更検知: {hasUnsavedChanges ? '有' : '無'} | 
        元データ: {originalData ? '有' : '無'} | 
        グループ数: {groups.length}
      </div>

      {/* セット情報編集エリア */}
      <div className="answer-card" style={{ marginBottom: '1.5rem' }}>
        <div className="answer-card-header">
          <span className="answer-label">問題セット情報</span>
          {!isEditingSetInfo ? (
            <button 
              className="answer-delete-btn" 
              onClick={() => setIsEditingSetInfo(true)}
              style={{ color: '#2563eb' }}
            >
              編集
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="answer-delete-btn" 
                onClick={cancelSetInfoEdit}
                style={{ color: '#dc2626' }}
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
        
        {!isEditingSetInfo ? (
          <div>
            <h1 className="answer-title" style={{ margin: '0 0 0.5rem 0' }}>
              {problemSetName}
            </h1>
            {problemSetDescription && (
              <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                {problemSetDescription}
              </p>
            )}
            {resultSetId && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
                  結果セット: 
                </span>
                <span style={{ fontSize: '0.875rem', color: '#2563eb', marginLeft: '0.25rem' }}>
                  {resultSets.find(rs => rs.id === resultSetId)?.name || `ID: ${resultSetId}`}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              className="answer-textarea"
              placeholder="セット名"
              value={problemSetName}
              onChange={(e) => {
                console.log('Problem set name changed:', e.target.value);
                setProblemSetName(e.target.value);
              }}
              style={{ height: 'auto', minHeight: '2.5rem' }}
            />
            <textarea
              className="answer-textarea"
              rows={2}
              placeholder="説明（任意）"
              value={problemSetDescription}
              onChange={(e) => {
                console.log('Problem set description changed:', e.target.value);
                setProblemSetDescription(e.target.value);
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                結果セット選択（任意）
              </label>
              <select
                className="answer-textarea"
                value={resultSetId || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setResultSetId(value ? Number(value) : null);
                }}
                style={{ height: 'auto', minHeight: '2.5rem' }}
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
        )}
      </div>

      {/* エラー表示 */}
      {errors.length > 0 && (
        <div style={{ 
          background: '#fee2e2', 
          border: '1px solid #fecaca', 
          borderRadius: '0.5rem', 
          padding: '1rem', 
          marginBottom: '1rem' 
        }}>
          <h3 style={{ color: '#dc2626', fontWeight: '600', marginBottom: '0.5rem' }}>
            保存できませんでした
          </h3>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {errors.map((error, idx) => (
              <li key={idx} style={{ color: '#dc2626' }}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {groups.map((g, gIdx) => (
        <section key={gIdx} className="qa-group">
          {/* 質問カード */}
          <div className="question-card">
            <div className="question-card-header">
              <label className="question-label">質問 {gIdx + 1}</label>
              <button className="question-delete-btn" onClick={() => deleteGroup(gIdx)}>
                削除
              </button>
            </div>
            <textarea
              className="question-textarea"
              rows={4}
              placeholder="ここに質問を入力してください..."
              value={g.q.text}
              onChange={(e) => editQuestion(gIdx, e.target.value)}
            />
          </div>

          {/* 回答カード群 */}
          <div className="answers-section">
            <div className="answers-section-label">回答選択肢</div>
            <div className="answer-grid">
            {g.a.map((a, aIdx) => (
              <div key={aIdx} className="answer-card">
                <div className="answer-card-header">
                  <label className="answer-label">回答 {a.index}</label>
                  <button className="answer-delete-btn" onClick={() => deleteAnswer(gIdx, aIdx)}>
                    削除
                  </button>
                </div>
                <textarea
                  className="answer-textarea"
                  rows={3}
                  placeholder="回答を入力"
                  value={a.text}
                  onChange={(e) => editAnswer(gIdx, aIdx, e.target.value)}
                />
                {/* 傾向 + 比重 */}
                <div className="tendency-weight-container">
                  <select
                      className="tendency-select"
                      value={a.tendency_id ?? ""}
                      onChange={(e) =>
                        editAnswerTendency(
                          gIdx,
                          aIdx,
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                    >
                      <option value="">-- 傾向を選択 --</option>
                      {tendencies.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  <span className="weight-label">点数:</span>
                  <input
                    type="number"
                    min={1}
                    className="weight-input"
                    value={a.weight}
                    onChange={(e) => editAnswerWeight(gIdx, aIdx, e.target.value)}
                  />
                </div>
              </div>
            ))}
            {g.a.length < A_MAX && (
              <button className="answer-add-card" onClick={() => addAnswer(gIdx)}>
                +
              </button>
            )}
          </div>
          </div>
        </section>
      ))}

      {/* 全体保存 */}
      <div className="save-all-section">
        <button 
          className={`save-all-button ${hasUnsavedChanges ? 'has-changes' : ''}`}
          onClick={saveAll}
        >
          {hasUnsavedChanges ? '変更を保存' : 'すべて保存'}
        </button>
        <div style={{ marginTop: '1rem' }}>
          {toastIdx === -1 && <span className="answer-toast">セット情報を保存しました！</span>}
          {toastIdx === -2 && <span className="answer-toast">質問を削除しました！</span>}
          {toastIdx === -3 && <span className="answer-toast">すべて保存しました！</span>}
        </div>
      </div>

      {/* グループ追加 */}
      {groups.length < Q_MAX && (
        <div className="qa-add-group-row">
          <button className="qa-add-group-btn" onClick={addGroup}>
            <span className="add-icon">➕</span> 質問を追加
          </button>
        </div>
      )}

      {/* 確認モーダル */}
      {showConfirmModal && (
        <div className="confirm-modal">
          <div className="confirm-modal-content">
            <h3 className="confirm-modal-title">⚠️ 未保存の変更があります</h3>
            <p className="confirm-modal-message">
              変更内容が保存されていません。<br/>
              このまま移動すると入力した内容が失われます。
            </p>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-btn cancel" onClick={handleCancelLeave}>
                戻る
              </button>
              <button className="confirm-modal-btn" onClick={handleConfirmLeave}>
                移動する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerMasterPage;
