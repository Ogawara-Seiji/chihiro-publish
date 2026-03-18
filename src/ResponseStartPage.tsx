import React from "react";
import { useNavigate } from "react-router-dom";
import "./AnswerMasterPage.css";

const ResponseStartPage: React.FC = () => {
  const navigate = useNavigate();

  const startResponse = () => {
    navigate("/user-select");
  };

  return (
    <div className="answer-root">
      <h1 className="answer-title">回答開始</h1>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '2rem'
      }}>
        <div style={{ 
          textAlign: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            color: '#374151'
          }}>
            質問に回答しましょう
          </h2>
          <p style={{ 
            fontSize: '1rem', 
            color: '#6b7280', 
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            まず、回答するユーザーを選択し、その後問題セットを選択して回答を開始してください。
          </p>
        </div>
        
        <button
          onClick={startResponse}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            minWidth: '200px'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
        >
          回答を開始
        </button>
      </div>
    </div>
  );
};

export default ResponseStartPage;
