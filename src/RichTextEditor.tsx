import React, { useRef, useState } from 'react';

// ResultPageのマークダウンパーサーをインポート（共通化）
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

const processItalic = (text: string, baseKey: number): string | JSX.Element => {
  const italicRegex = /\*(.*?)\*/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  let key = baseKey * 1000;

  while ((match = italicRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    parts.push(
      <em key={key++}>{match[1]}</em>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  if (parts.length === 1 && typeof parts[0] === 'string') {
    return parts[0];
  }
  
  return <>{parts}</>;
};

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  rows = 8
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedText, setSelectedText] = useState<{
    start: number;
    end: number;
    text: string;
  } | null>(null);

  // テキスト選択の検出
  const handleTextSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value.substring(start, end);

    if (text.length > 0) {
      setSelectedText({ start, end, text });
    } else {
      setSelectedText(null);
    }
  };

  // 選択テキストに装飾を適用
  const applyFormatting = (format: 'bold' | 'italic' | 'size:large' | 'size:small' | 'color:red' | 'color:blue' | 'color:green' | 'center' | 'right' | 'left') => {
    if (!selectedText || !textareaRef.current) return;

    const { start, end, text } = selectedText;
    let formattedText = '';
    
    switch (format) {
      case 'bold':
        formattedText = `**${text}**`;
        break;
      case 'italic':
        formattedText = `*${text}*`;
        break;
      case 'size:large':
        formattedText = `{size:large}${text}{/}`;
        break;
      case 'size:small':
        formattedText = `{size:small}${text}{/}`;
        break;
      case 'color:red':
        formattedText = `{color:red}${text}{/}`;
        break;
      case 'color:blue':
        formattedText = `{color:blue}${text}{/}`;
        break;
      case 'color:green':
        formattedText = `{color:green}${text}{/}`;
        break;
      case 'center':
        // 行の始まりを見つけて:center:を追加
        const beforeText = value.substring(0, start);
        const lineStart = beforeText.lastIndexOf('\n') + 1;
        const lineText = value.substring(lineStart, end);
        formattedText = `:center: ${lineText}`;
        // 行全体を置換するため、startとendを調整
        const newStart = lineStart;
        const newEnd = end;
        const newValue = value.substring(0, newStart) + formattedText + value.substring(newEnd);
        onChange(newValue);
        setSelectedText(null);
        return;
      case 'right':
        const beforeTextRight = value.substring(0, start);
        const lineStartRight = beforeTextRight.lastIndexOf('\n') + 1;
        const lineTextRight = value.substring(lineStartRight, end);
        formattedText = `:right: ${lineTextRight}`;
        const newStartRight = lineStartRight;
        const newEndRight = end;
        const newValueRight = value.substring(0, newStartRight) + formattedText + value.substring(newEndRight);
        onChange(newValueRight);
        setSelectedText(null);
        return;
      case 'left':
        const beforeTextLeft = value.substring(0, start);
        const lineStartLeft = beforeTextLeft.lastIndexOf('\n') + 1;
        const lineTextLeft = value.substring(lineStartLeft, end);
        formattedText = `:left: ${lineTextLeft}`;
        const newStartLeft = lineStartLeft;
        const newEndLeft = end;
        const newValueLeft = value.substring(0, newStartLeft) + formattedText + value.substring(newEndLeft);
        onChange(newValueLeft);
        setSelectedText(null);
        return;
    }

    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);
    setSelectedText(null);

    // フォーカスを戻す
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + formattedText.length, start + formattedText.length);
      }
    }, 0);
  };

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', overflow: 'hidden' }}>
      {/* ツールバー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        flexWrap: 'wrap'
      }}>
        {/* プレビュー切り替え */}
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.875rem',
            borderRadius: '0.25rem',
            border: '1px solid #d1d5db',
            backgroundColor: showPreview ? '#3b82f6' : '#ffffff',
            color: showPreview ? '#ffffff' : '#374151',
            cursor: 'pointer'
          }}
        >
          {showPreview ? '📝 編集' : '👁️ プレビュー'}
        </button>

        {!showPreview && (
          <>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0' }} />
            
            {/* 装飾ボタン */}
            <button
              type="button"
              onClick={() => applyFormatting('bold')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                fontWeight: 'bold',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#ffffff' : '#f3f4f6',
                color: selectedText ? '#374151' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="太字 (**文字**)"
            >
              B
            </button>

            <button
              type="button"
              onClick={() => applyFormatting('italic')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                fontStyle: 'italic',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#ffffff' : '#f3f4f6',
                color: selectedText ? '#374151' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="斜体 (*文字*)"
            >
              I
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0' }} />

            {/* 文字サイズ */}
            <button
              type="button"
              onClick={() => applyFormatting('size:large')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#ffffff' : '#f3f4f6',
                color: selectedText ? '#374151' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="大きい文字"
            >
              大
            </button>

            <button
              type="button"
              onClick={() => applyFormatting('size:small')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#ffffff' : '#f3f4f6',
                color: selectedText ? '#374151' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="小さい文字"
            >
              小
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0' }} />

            {/* 色 */}
            <button
              type="button"
              onClick={() => applyFormatting('color:red')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#fef2f2' : '#f3f4f6',
                color: selectedText ? '#dc2626' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="赤色"
            >
              赤
            </button>

            <button
              type="button"
              onClick={() => applyFormatting('color:blue')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#eff6ff' : '#f3f4f6',
                color: selectedText ? '#2563eb' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="青色"
            >
              青
            </button>

            <button
              type="button"
              onClick={() => applyFormatting('color:green')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#f0fdf4' : '#f3f4f6',
                color: selectedText ? '#16a34a' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="緑色"
            >
              緑
            </button>

            <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0' }} />

            {/* 配置 */}
            <button
              type="button"
              onClick={() => applyFormatting('left')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#ffffff' : '#f3f4f6',
                color: selectedText ? '#374151' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="左寄せ"
            >
              ◄
            </button>

            <button
              type="button"
              onClick={() => applyFormatting('center')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#ffffff' : '#f3f4f6',
                color: selectedText ? '#374151' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="中央寄せ"
            >
              ◆
            </button>

            <button
              type="button"
              onClick={() => applyFormatting('right')}
              disabled={!selectedText}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.875rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: selectedText ? '#ffffff' : '#f3f4f6',
                color: selectedText ? '#374151' : '#9ca3af',
                cursor: selectedText ? 'pointer' : 'not-allowed'
              }}
              title="右寄せ"
            >
              ►
            </button>
          </>
        )}

        {selectedText && !showPreview && (
          <div style={{
            marginLeft: 'auto',
            fontSize: '0.75rem',
            color: '#6b7280',
            fontStyle: 'italic'
          }}>
            "{selectedText.text}" を選択中
          </div>
        )}
      </div>

      {/* エディタ/プレビューエリア */}
      {showPreview ? (
        <div style={{
          padding: '1rem',
          minHeight: `${rows * 1.5}rem`,
          backgroundColor: '#ffffff',
          lineHeight: '1.8',
          fontSize: '1rem'
        }}>
          {value.trim() ? parseMarkdown(value) : (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              プレビューするテキストを入力してください
            </div>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          className="answer-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={handleTextSelection}
          onMouseUp={handleTextSelection}
          onKeyUp={handleTextSelection}
          placeholder={placeholder}
          rows={rows}
          style={{
            fontFamily: 'inherit',
            fontSize: '14px',
            lineHeight: '1.5',
            border: 'none',
            borderRadius: '0',
            resize: 'vertical'
          }}
        />
      )}
      
      {/* ヘルプテキスト */}
      <div style={{
        padding: '0.5rem 0.75rem',
        backgroundColor: '#f1f5f9',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.75rem',
        color: '#64748b'
      }}>
        💡 テキストを選択してツールバーのボタンで装飾できます。見出し: # ## ###、リスト: - * 1.
      </div>
    </div>
  );
};

export default RichTextEditor;
