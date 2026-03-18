import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

// 型定義
type UserResult = {
  result_set_id: number;
  result_set_title: string | null;
  contents: string[];
};

// 簡単なマークダウンパーサー
const parseMarkdown = (text: string): JSX.Element => {
  const lines = text.split('\n');
  
  return (
    <>
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} style={{ marginBottom: lineIndex < lines.length - 1 ? '0.5rem' : '0' }}>
          {parseLineMarkdown(line)}
        </div>
      ))}
    </>
  );
};

// 行レベルのマークダウン処理（見出し、リストなど）
const parseLineMarkdown = (line: string): JSX.Element => {
  // 見出しをチェック
  const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const text = headingMatch[2];
    
    const headingStyles = {
      1: { fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' },
      2: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.8rem', color: '#444' },
      3: { fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.6rem', color: '#555' }
    };
    
    return (
      <div style={headingStyles[level as keyof typeof headingStyles]}>
        {parseInlineMarkdown(text)}
      </div>
    );
  }
  
  // 順序なしリストをチェック (- または * で始まる)
  const unorderedListMatch = line.match(/^[-*]\s+(.+)$/);
  if (unorderedListMatch) {
    return (
      <div style={{ marginLeft: '1rem', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '-1rem' }}>•</span>
        {parseInlineMarkdown(unorderedListMatch[1])}
      </div>
    );
  }
  
  // 順序ありリストをチェック (数字. で始まる)
  const orderedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
  if (orderedListMatch) {
    return (
      <div style={{ marginLeft: '1.5rem', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '-1.5rem' }}>{orderedListMatch[1]}.</span>
        {parseInlineMarkdown(orderedListMatch[2])}
      </div>
    );
  }
  
  // テキスト配置をチェック
  const alignCenterMatch = line.match(/^:center:\s*(.+)$/);
  if (alignCenterMatch) {
    return (
      <div style={{ textAlign: 'center' }}>
        {parseInlineMarkdown(alignCenterMatch[1])}
      </div>
    );
  }
  
  const alignRightMatch = line.match(/^:right:\s*(.+)$/);
  if (alignRightMatch) {
    return (
      <div style={{ textAlign: 'right' }}>
        {parseInlineMarkdown(alignRightMatch[1])}
      </div>
    );
  }
  
  const alignLeftMatch = line.match(/^:left:\s*(.+)$/);
  if (alignLeftMatch) {
    return (
      <div style={{ textAlign: 'left' }}>
        {parseInlineMarkdown(alignLeftMatch[1])}
      </div>
    );
  }
  
  // 通常の行として処理
  return <span>{parseInlineMarkdown(line)}</span>;
};

const parseInlineMarkdown = (text: string): JSX.Element => {
  // 特殊なマークダウン記法を処理
  const elements: JSX.Element[] = [];
  let key = 0;

  // 文字サイズと色の組み合わせを処理
  const styleRegex = /\{(size:(large|medium|small|\d+px))?\s*(color:(red|blue|green|black|gray|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}))?\}([^{]*)\{\/\}/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = styleRegex.exec(text)) !== null) {
    // マッチ前のテキスト
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      elements.push(<span key={key++}>{processBoldAndItalic(beforeText)}</span>);
    }
    
    // スタイル適用
    const sizeValue = match[2];
    const colorValue = match[4];
    const content = match[5];
    
    const style: React.CSSProperties = {};
    
    if (sizeValue) {
      switch (sizeValue) {
        case 'large': style.fontSize = '1.5rem'; break;
        case 'small': style.fontSize = '0.8rem'; break;
        case 'medium': style.fontSize = '1rem'; break;
        default: 
          if (sizeValue.endsWith('px')) style.fontSize = sizeValue;
          break;
      }
    }
    
    if (colorValue) {
      style.color = colorValue;
    }
    
    elements.push(
      <span key={key++} style={style}>
        {processBoldAndItalic(content)}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // 残りのテキスト
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    elements.push(<span key={key++}>{processBoldAndItalic(remainingText)}</span>);
  }
  
  // スタイル記法がない場合は通常処理
  if (elements.length === 0) {
    return processBoldAndItalic(text);
  }
  
  return <>{elements}</>;
};

// 太字・斜体処理を分離
const processBoldAndItalic = (text: string): JSX.Element => {
  const parts: (string | JSX.Element)[] = [];
  let key = 0;

  // **太字** を処理
  const boldRegex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    // マッチする前のテキストを追加
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      if (beforeText) {
        parts.push(processItalic(beforeText, key++));
      }
    }
    
    // 太字テキストを追加
    parts.push(
      <strong key={key++}>{processItalic(match[1], key++)}</strong>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // 残りのテキストを追加
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      parts.push(processItalic(remainingText, key++));
    }
  }
  
  return <>{parts}</>;
};

// *斜体* を処理
const processItalic = (text: string, baseKey: number): string | JSX.Element => {
  const italicRegex = /\*(.*?)\*/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let key = baseKey * 1000; // キーの重複を避ける

  while ((match = italicRegex.exec(text)) !== null) {
    // マッチする前のテキストを追加
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // 斜体テキストを追加
    parts.push(
      <em key={key++}>{match[1]}</em>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // 残りのテキストを追加
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  // 変更がない場合は元のテキストを返す
  if (parts.length === 1 && typeof parts[0] === 'string') {
    return parts[0];
  }
  
  return <>{parts}</>;
};

const ResultPage: React.FC = () => {
  const { userId, problemSetId } = useParams<{ userId: string; problemSetId: string }>();
  const [result, setResult] = useState<UserResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadResult = async () => {
      if (!userId || !problemSetId) {
        setError("必要なパラメータが不足しています");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userIdNum = Number(userId);
        const problemSetIdNum = Number(problemSetId);
        
        console.log("Loading result for:", { userIdNum, problemSetIdNum });
        
        const resultData = await invoke<UserResult>("calculate_user_result", {
          userId: userIdNum,
          problemSetId: problemSetIdNum,
        });
        
        console.log("Result data:", resultData);
        setResult(resultData);
      } catch (err) {
        console.error("結果計算エラー:", err);
        setError(`結果の計算に失敗しました: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [userId, problemSetId]);

  const goBack = () => {
    navigate(`/problem-select/${userId}`);
  };

  const goHome = () => {
    navigate("/user-select");
  };

  if (loading) {
    return (
      <div className="result-container">
        <h1 className="result-title">結果を計算中...</h1>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>少々お待ちください...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="result-container">
        <h1 className="result-title">エラーが発生しました</h1>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>
          <button onClick={goBack} className="retry-btn">
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!result || result.contents.length === 0) {
    return (
      <div className="result-container">
        <h1 className="result-title">結果が見つかりません</h1>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>結果が設定されていないか、条件を満たす結果がありません。</p>
          <button onClick={goBack} className="retry-btn">
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="result-container">
      <h1 className="result-title">
        {result.result_set_title || "あなたの結果"}
      </h1>
      <div className="result-circles">
        {result.contents.map((content, idx) => (
          <div key={idx} className="result-circle">
            <div style={{ 
              lineHeight: '1.8', 
              width: '100%',
              fontSize: '1.1rem'
            }}>
              {parseMarkdown(content)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        justifyContent: 'center',
        marginTop: '2rem'
      }}>
        <button onClick={goBack} className="retry-btn">
          問題選択に戻る
        </button>
        <button onClick={goHome} className="retry-btn">
          最初に戻る
        </button>
      </div>
    </div>
  );
};

export default ResultPage;
