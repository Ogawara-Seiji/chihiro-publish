import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useParams, useNavigate } from "react-router-dom";
import "./AnswerMasterPage.css";
import RichTextEditor from "./RichTextEditor";

/* ---------- 型 ---------- */
export type ResultRule = {
  id?: number;
  set_id: number;
  condition_type: 'threshold' | 'top_display'; // しきい値型 or 上位表示型
  display_count?: number | null; // 表示件数（上位表示条件のみ）
};

export type ResultContent = {
  id?: number;
  set_id: number;
  content_index: number;
  content: string; // 結果内容（説明とアドバイスを統合）
  conditions: ThresholdCondition[]; // しきい値条件（複数）
  logic_operator: 'and' | 'or'; // この結果内容内での条件結合方法
  tendency_id?: number; // 上位表示条件の時に使用する傾向ID
};

export type ThresholdCondition = {
  id?: number;
  content_id?: number;
  condition_index: number;
  tendency_id: number;
  threshold_score: number;
};

/* -------------------------------------------------------------- */
const ResultMasterPage: React.FC = () => {
  /* ---- URL から結果セット ID ---- */
  const { setId } = useParams();
  const resultSetId = Number(setId) || 0;
  const navigate = useNavigate();

  /* ---- State ---- */
  const [rule, setRule] = useState<ResultRule | null>(null); // 1セット1ルール
  const [contents, setContents] = useState<ResultContent[]>([]); // 複数の結果内容
  const [toastIdx, setToastIdx] = useState<number | null>(null);
  const [tendencies, setTendencies] = useState<{ id: number; name: string }[]>([]);
  const [resultSetName, setResultSetName] = useState<string>("");
  const [resultSetDescription, setResultSetDescription] = useState<string>("");
  const [resultTitle, setResultTitle] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  
  // 未保存警告関連
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    type: 'link' | 'browser';
    href?: string;
    callback?: () => void;
  } | null>(null);
  const [originalData, setOriginalData] = useState<{
    rule: ResultRule | null;
    contents: ResultContent[];
    setName: string;
    setDescription: string;
    title: string;
  } | null>(null);

  /* ---- Util ---- */
  // データが変更されているかチェック
  const checkForChanges = () => {
    if (!originalData) return false;
    
    const currentData = {
      rule: rule,
      contents: contents,
      setName: resultSetName,
      setDescription: resultSetDescription,
      title: resultTitle
    };
    
    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  };

  // 変更検知
  useEffect(() => {
    const hasChanges = checkForChanges();
    setHasUnsavedChanges(hasChanges);
  }, [rule, contents, resultSetName, resultSetDescription, resultTitle, originalData]);

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
        if (link && link.href) {
          // 同じページ内のハッシュリンクでない場合は警告
          const currentPath = window.location.pathname + window.location.hash;
          const linkPath = new URL(link.href).pathname + new URL(link.href).hash;
          if (currentPath !== linkPath) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Preventing navigation to:', link.href);
            setPendingNavigation({ type: 'link', href: link.href });
            setShowConfirmModal(true);
          }
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
    window.history.pushState(null, '', window.location.href);

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleLinkClick, true); // capture phase
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleLinkClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges]);

  /* ---- 初期ロード ---- */
  useEffect(() => {
    if (resultSetId <= 0) return;
    loadData();
  }, [resultSetId]);

  const loadData = async () => {
    try {
      // 傾向リスト取得
      const tendencyData = await invoke<{ id: number; name: string }[]>("list_tendencies");
      setTendencies(tendencyData);

      // 結果セット情報取得
      const setData = await invoke<{ id: number; name: string; description: string; title: string }>(
        "get_result_set",
        { id: resultSetId }
      );
      setResultSetName(setData.name);
      setResultSetDescription(setData.description);
      setResultTitle(setData.title || "");

      // ルール取得
      const ruleData = await invoke<ResultRule | null>("get_result_rule", { setId: resultSetId });
      setRule(ruleData);

      // 結果内容取得
      const contentsData = await invoke<ResultContent[]>("list_result_contents", { setId: resultSetId });
      setContents(contentsData);

      // 元データ保存（変更検知用）
      setOriginalData({
        rule: ruleData,
        contents: contentsData,
        setName: setData.name,
        setDescription: setData.description,
        title: setData.title || ""
      });

    } catch (err) {
      console.error("データ読み込みエラー:", err);
      setErrors(["データの読み込みに失敗しました。"]);
    }
  };

  /* ---- ルール操作 ---- */
  const handleRuleConditionTypeChange = (type: 'threshold' | 'top_display') => {
    if (!rule) {
      // 新規ルール作成
      const newRule: ResultRule = {
        set_id: resultSetId,
        condition_type: type,
        display_count: type === 'top_display' ? 1 : null
      };
      setRule(newRule);
    } else {
      // 既存ルールの条件タイプ変更
      setRule({
        ...rule,
        condition_type: type,
        display_count: type === 'top_display' ? (rule.display_count || 1) : null
      });
    }
  };

  const handleRuleDisplayCountChange = (count: number) => {
    if (rule) {
      setRule({ ...rule, display_count: count });
    }
  };

  /* ---- コンテンツ操作 ---- */
  const addContent = () => {
    const newContent: ResultContent = {
      set_id: resultSetId,
      content_index: contents.length,
      content: "",
      conditions: [],
      logic_operator: 'and',
      tendency_id: undefined
    };
    setContents([...contents, newContent]);
  };

  const removeContent = (index: number) => {
    const newContents = contents.filter((_, i) => i !== index)
      .map((content, i) => ({ ...content, content_index: i }));
    setContents(newContents);
  };

  const updateContentContent = (index: number, content: string) => {
    const newContents = contents.map((contentItem, i) => 
      i === index ? { ...contentItem, content } : contentItem
    );
    setContents(newContents);
  };

  const updateContentLogicOperator = (index: number, operator: 'and' | 'or') => {
    const newContents = contents.map((content, i) => 
      i === index ? { ...content, logic_operator: operator } : content
    );
    setContents(newContents);
  };

  const updateContentTendencyId = (index: number, tendencyId: number) => {
    const newContents = contents.map((content, i) => 
      i === index ? { ...content, tendency_id: tendencyId } : content
    );
    setContents(newContents);
  };

  /* ---- しきい値条件操作 ---- */
  const addThresholdCondition = (contentIndex: number) => {
    const newContents = contents.map((content, i) => {
      if (i === contentIndex) {
        const newCondition: ThresholdCondition = {
          condition_index: content.conditions.length,
          tendency_id: 0,
          threshold_score: 0
        };
        return {
          ...content,
          conditions: [...content.conditions, newCondition]
        };
      }
      return content;
    });
    setContents(newContents);
  };

  const removeThresholdCondition = (contentIndex: number, conditionIndex: number) => {
    const newContents = contents.map((content, i) => {
      if (i === contentIndex) {
        const newConditions = content.conditions.filter((_, j) => j !== conditionIndex)
          .map((condition, j) => ({ ...condition, condition_index: j }));
        return { ...content, conditions: newConditions };
      }
      return content;
    });
    setContents(newContents);
  };

  const updateThresholdCondition = (contentIndex: number, conditionIndex: number, field: keyof ThresholdCondition, value: any) => {
    const newContents = contents.map((content, i) => {
      if (i === contentIndex) {
        const newConditions = content.conditions.map((condition, j) => 
          j === conditionIndex ? { ...condition, [field]: value } : condition
        );
        return { ...content, conditions: newConditions };
      }
      return content;
    });
    setContents(newContents);
  };

  /* ---- 保存 ---- */
  const handleSave = async () => {
    try {
      const validationErrors = validateData();
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      // 結果セット情報更新
      await invoke("update_result_set", {
        id: resultSetId,
        name: resultSetName,
        description: resultSetDescription,
        title: resultTitle
      });

      // ルール保存
      if (rule) {
        await invoke("save_result_rule", {
          setId: resultSetId,
          rule: rule
        });
      }

      // コンテンツ保存
      await invoke("save_result_contents", {
        setId: resultSetId,
        contents: contents
      });

      // 元データ更新
      setOriginalData({
        rule: rule,
        contents: contents,
        setName: resultSetName,
        setDescription: resultSetDescription,
        title: resultTitle
      });

      setErrors([]);
      setToastIdx(Date.now());
      setTimeout(() => setToastIdx(null), 3000);

    } catch (err) {
      console.error("保存エラー:", err);
      setErrors(["保存に失敗しました。"]);
    }
  };

  const validateData = (): string[] => {
    const errors: string[] = [];

    if (!resultSetName.trim()) {
      errors.push("結果セット名は必須です。");
    }

    if (!rule) {
      errors.push("条件ルールを設定してください。");
    } else {
      if (rule.condition_type === 'top_display') {
        if (!rule.display_count || rule.display_count <= 0) {
          errors.push("上位表示条件では表示件数の入力が必須です。");
        }
      }
    }

    if (contents.length === 0) {
      errors.push("結果説明・アドバイスを最低1つ登録してください。");
    }

    contents.forEach((content, index) => {
      if (!content.content.trim()) {
        errors.push(`${index + 1}番目の結果内容は必須です。`);
      }

      if (rule?.condition_type === 'threshold') {
        if (content.conditions.length === 0) {
          errors.push(`${index + 1}番目の結果内容にしきい値条件を設定してください。`);
        }
        content.conditions.forEach((condition, condIndex) => {
          if (!condition.tendency_id) {
            errors.push(`${index + 1}番目の結果内容の${condIndex + 1}番目の条件で傾向を選択してください。`);
          }
          if (!condition.threshold_score || condition.threshold_score <= 0) {
            errors.push(`${index + 1}番目の結果内容の${condIndex + 1}番目の条件で点数を入力してください。`);
          }
        });
      } else if (rule?.condition_type === 'top_display') {
        if (!content.tendency_id) {
          errors.push(`${index + 1}番目の結果内容で傾向を選択してください。`);
        }
      }
    });

    return errors;
  };

  /* ---- 確認モーダル ---- */
  const handleConfirmNavigation = () => {
    if (pendingNavigation) {
      if (pendingNavigation.type === 'link' && pendingNavigation.href) {
        setHasUnsavedChanges(false);
        window.location.href = pendingNavigation.href;
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

  const handleCancelNavigation = () => {
    setShowConfirmModal(false);
    setPendingNavigation(null);
  };

  const handleNavigateToList = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation({ 
        type: 'browser', 
        callback: () => navigate('/result-set-master')
      });
      setShowConfirmModal(true);
    } else {
      navigate('/result-set-master');
    }
  };

  /* ---- レンダリング ---- */
  return (
    <div className="answer-root">
      <h1 className="answer-title">結果マスター編集</h1>

      {/* エラー表示 */}
      {errors.length > 0 && (
        <div className="answer-error-message">
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}

      {/* 成功メッセージ */}
      {toastIdx && (
        <div className="answer-toast">
          保存しました！
        </div>
      )}

      {/* 結果セット情報 */}
      <div style={{ 
        backgroundColor: '#f8fafc', 
        border: '1px solid #e2e8f0', 
        borderRadius: '0.75rem', 
        padding: '1.5rem', 
        marginBottom: '2rem' 
      }}>
        <h2 style={{ 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          marginBottom: '1rem', 
          color: '#1e293b' 
        }}>
          結果セット情報
        </h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '600', 
            color: '#374151' 
          }}>
            結果セット名:
          </label>
          <input
            className="answer-textarea"
            placeholder="結果セット名を入力してください"
            value={resultSetName}
            onChange={(e) => setResultSetName(e.target.value)}
            style={{ 
              marginBottom: '0',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db'
            }}
          />
        </div>
        
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '600', 
            color: '#374151' 
          }}>
            説明:
          </label>
          <textarea
            className="answer-textarea"
            placeholder="結果セットの説明を入力してください"
            value={resultSetDescription}
            onChange={(e) => setResultSetDescription(e.target.value)}
            rows={3}
            style={{ 
              marginBottom: '0',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db'
            }}
          />
        </div>
      </div>

      {/* 結果画面タイトル */}
      <div style={{ 
        backgroundColor: '#f0f9ff', 
        border: '1px solid #0ea5e9', 
        borderRadius: '0.75rem', 
        padding: '1.5rem', 
        marginBottom: '2rem' 
      }}>
        <h2 style={{ 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          marginBottom: '1rem', 
          color: '#0c4a6e' 
        }}>
          結果画面タイトル
        </h2>
        <input
          className="answer-textarea"
          placeholder="結果画面に表示されるタイトルを入力してください"
          value={resultTitle}
          onChange={(e) => setResultTitle(e.target.value)}
          style={{ 
            marginBottom: '0', 
            fontSize: '14px',
            backgroundColor: '#ffffff',
            border: '1px solid #0ea5e9'
          }}
        />
        <div style={{ 
          fontSize: '12px', 
          color: '#0369a1', 
          marginTop: '0.5rem',
          fontStyle: 'italic'
        }}>
          💡 クイズ結果ページの上部に表示されるタイトルです
        </div>
      </div>

      {/* 条件ルール */}
      <div style={{ 
        backgroundColor: '#f0fdf4', 
        border: '1px solid #86efac', 
        borderRadius: '0.75rem', 
        padding: '1.5rem', 
        marginBottom: '2rem' 
      }}>
        <h2 style={{ 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          marginBottom: '1rem', 
          color: '#14532d' 
        }}>
          条件ルール設定
        </h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '600', 
            color: '#374151' 
          }}>
            条件タイプ:
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #d1d5db',
              backgroundColor: rule?.condition_type === 'threshold' ? '#dbeafe' : '#ffffff'
            }}>
              <input
                type="radio"
                name="conditionType"
                value="threshold"
                checked={rule?.condition_type === 'threshold'}
                onChange={() => handleRuleConditionTypeChange('threshold')}
                style={{ marginRight: '0.5rem' }}
              />
              しきい値条件
            </label>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #d1d5db',
              backgroundColor: rule?.condition_type === 'top_display' ? '#dbeafe' : '#ffffff'
            }}>
              <input
                type="radio"
                name="conditionType"
                value="top_display"
                checked={rule?.condition_type === 'top_display'}
                onChange={() => handleRuleConditionTypeChange('top_display')}
                style={{ marginRight: '0.5rem' }}
              />
              上位表示条件
            </label>
          </div>
        </div>

        {rule && rule.condition_type === 'top_display' && (
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: '600', 
              color: '#374151' 
            }}>
              表示件数:
            </label>
            <input
              type="number"
              value={rule.display_count || ''}
              onChange={(e) => handleRuleDisplayCountChange(Number(e.target.value))}
              placeholder="表示件数を入力"
              min="1"
              style={{ 
                width: '200px',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '14px'
              }}
            />
            <div style={{ 
              fontSize: '12px', 
              color: '#6b7280', 
              marginTop: '0.5rem',
              fontStyle: 'italic'
            }}>
              💡 上位何件まで表示するかを設定してください
            </div>
          </div>
        )}
      </div>

      {/* 結果内容一覧 */}
      <div className="answer-grid">
        {contents.map((content, index) => (
          <div key={index} className="answer-card">
            <div className="answer-card-header">
              <span className="answer-label">結果内容 #{index + 1}</span>
              <button
                className="qa-delete-btn"
                onClick={() => removeContent(index)}
                title="この結果内容を削除"
              >
                🗑️
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                結果内容 (マークダウン対応):
              </label>
              <RichTextEditor
                value={content.content}
                onChange={(value) => updateContentContent(index, value)}
                placeholder="結果の説明とアドバイスを入力してください&#10;&#10;例:&#10;**おめでとうございます！** 🎉&#10;あなたは○○タイプです。&#10;&#10;**アドバイス:** ✨&#10;・○○を心がけましょう&#10;・○○に注意してください"
                rows={8}
              />
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                marginTop: '0.25rem',
                fontStyle: 'italic'
              }}>
                💡 テキストを選択してツールバーで装飾できます。太字: **文字**、色: {'{color:red}文字{/}'}、配置: :center: 文字
              </div>
            </div>

            {/* しきい値条件設定 */}
            {rule?.condition_type === 'threshold' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: '600' }}>しきい値条件:</label>
                  <button
                    className="qa-add-btn"
                    onClick={() => addThresholdCondition(index)}
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                  >
                    + 条件追加
                  </button>
                </div>

                {content.conditions.length > 1 && (
                  <div style={{ 
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '0.375rem',
                    border: '1px solid #cbd5e1'
                  }}>
                    <label style={{ fontWeight: '600', color: '#475569' }}>
                      この結果内容の条件結合:
                      <select
                        value={content.logic_operator}
                        onChange={(e) => updateContentLogicOperator(index, e.target.value as 'and' | 'or')}
                        style={{ 
                          marginLeft: '0.5rem', 
                          fontSize: '0.9rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          border: '1px solid #cbd5e1'
                        }}
                      >
                        <option value="and">AND（すべての条件を満たす）</option>
                        <option value="or">OR（いずれかの条件を満たす）</option>
                      </select>
                    </label>
                  </div>
                )}

                {content.conditions.map((condition, condIndex) => (
                  <div key={condIndex}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: '0.5rem',
                      padding: '0.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.375rem',
                      backgroundColor: '#f8fafc'
                    }}>
                      <select
                        value={condition.tendency_id || ''}
                        onChange={(e) => updateThresholdCondition(index, condIndex, 'tendency_id', Number(e.target.value))}
                        style={{ marginRight: '0.5rem', flex: 1 }}
                      >
                        <option value="">傾向を選択</option>
                        {tendencies.map((tendency) => (
                          <option key={tendency.id} value={tendency.id}>
                            {tendency.name}
                          </option>
                        ))}
                      </select>
                      <span style={{ margin: '0 0.5rem' }}>が</span>
                      <input
                        type="number"
                        value={condition.threshold_score || ''}
                        onChange={(e) => updateThresholdCondition(index, condIndex, 'threshold_score', Number(e.target.value))}
                        placeholder="点数"
                        min="1"
                        style={{ width: '80px', marginRight: '0.5rem' }}
                      />
                      <span style={{ marginRight: '0.5rem' }}>点以上</span>
                      <button
                        onClick={() => removeThresholdCondition(index, condIndex)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer',
                          fontSize: '1rem'
                        }}
                        title="この条件を削除"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {/* 条件間の AND/OR 表示 */}
                    {condIndex < content.conditions.length - 1 && (
                      <div style={{ 
                        textAlign: 'center',
                        margin: '0.5rem 0',
                        fontWeight: '600',
                        color: content.logic_operator === 'and' ? '#059669' : '#dc2626',
                        fontSize: '0.9rem'
                      }}>
                        {content.logic_operator === 'and' ? 'AND' : 'OR'}
                      </div>
                    )}
                  </div>
                ))}

                {content.conditions.length === 0 && (
                  <div style={{ 
                    padding: '1rem', 
                    textAlign: 'center', 
                    color: '#6b7280',
                    border: '2px dashed #d1d5db',
                    borderRadius: '0.375rem'
                  }}>
                    しきい値条件が設定されていません。「+ 条件追加」ボタンで追加してください。
                  </div>
                )}
              </div>
            )}

            {/* 上位表示条件設定 */}
            {rule?.condition_type === 'top_display' && (
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                  傾向の属性:
                </label>
                <div style={{ 
                  padding: '0.75rem',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '0.375rem',
                  border: '1px solid #0ea5e9'
                }}>
                  <select
                    value={content.tendency_id || ''}
                    onChange={(e) => updateContentTendencyId(index, Number(e.target.value))}
                    style={{ 
                      width: '100%',
                      padding: '0.5rem',
                      fontSize: '0.9rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #cbd5e1'
                    }}
                  >
                    <option value="">傾向を選択してください</option>
                    {tendencies.map((tendency) => (
                      <option key={tendency.id} value={tendency.id}>
                        {tendency.name}
                      </option>
                    ))}
                  </select>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#0369a1', 
                    marginTop: '0.5rem',
                    fontStyle: 'italic'
                  }}>
                    💡 上位表示で集計する際の傾向属性を選択してください
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* プラスボタンカード */}
        <div className="answer-add-card" onClick={addContent}>
          <div className="add-icon">➕</div>
          <div>新しい結果内容を追加</div>
        </div>
      </div>

      {/* 保存ボタン */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '2rem 0', 
        borderTop: '1px solid #e5e7eb',
        marginTop: '2rem',
        gap: '1rem'
      }}>
        <button
          onClick={handleNavigateToList}
          className="confirm-modal-btn cancel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: '140px'
          }}
        >
          ← 一覧に戻る
        </button>
        
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
          className="confirm-modal-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: '140px',
            background: hasUnsavedChanges 
              ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' 
              : '#e5e7eb',
            color: hasUnsavedChanges ? 'white' : '#9ca3af',
            cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
            opacity: hasUnsavedChanges ? 1 : 0.7
          }}
          onMouseOver={(e) => {
            if (hasUnsavedChanges) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #15803d 0%, #166534 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)';
            }
          }}
          onMouseOut={(e) => {
            if (hasUnsavedChanges) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          {hasUnsavedChanges ? '💾 変更を保存' : '✓ 保存済み'}
        </button>
      </div>

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
              <button className="confirm-modal-btn cancel" onClick={handleCancelNavigation}>
                戻る
              </button>
              <button className="confirm-modal-btn" onClick={handleConfirmNavigation}>
                移動する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultMasterPage;
