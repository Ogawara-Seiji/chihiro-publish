// App.tsx

import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import ResultPage from "./ResultPage";
import TendencyMasterPage from "./TendencyMasterPage";
import AnswerMasterPage from "./AnswerMasterPage";
import ProblemSetMasterPage from "./ProblemSetMasterPage";
import ResultSetMasterPage from "./ResultSetMasterPage";
import ResultMasterPage from "./ResultMasterPage";
import ProblemSelectPage from "./ProblemSelectPage";
import ResponsePage from "./ResponsePage";
import UserMasterPage from "./UserMasterPage";
import ResponseStartPage from "./ResponseStartPage";
import UserSelectPage from "./UserSelectPage";
import ResponseAggregationPage from "./ResponseAggregationPage";


const App: React.FC = () => {
  return (
    <>
      <nav className="flex gap-4 p-4 bg-slate-100 flex-wrap">
        <Link to="/" className="hover:text-blue-600">回答開始</Link>
        <div className="border-l border-gray-400 mx-2"></div>
        <Link to="/user-master" className="hover:text-blue-600">ユーザー管理</Link>
        <Link to="/problem-set-master" className="hover:text-blue-600">問題セット</Link>
        <Link to="/result-set-master" className="hover:text-blue-600">結果セット</Link>
        <Link to="/tendency-master" className="hover:text-blue-600">傾向マスター</Link>
        <Link to="/response-aggregation" className="hover:text-blue-600">回答集計</Link>
      </nav>
      <Routes>
        <Route path="/" element={<ResponseStartPage />} />
        <Route path="/result/:userId/:problemSetId" element={<ResultPage />} />
        <Route path="/user-select" element={<UserSelectPage />} />
        <Route path="/problem-select/:userId" element={<ProblemSelectPage />} />
        <Route path="/response/:userId/:problemSetId" element={<ResponsePage />} />
        <Route path="/user-master" element={<UserMasterPage />} />
        <Route path="/tendency-master" element={<TendencyMasterPage />} />
        <Route path="/problem-set-master" element={<ProblemSetMasterPage />} />
        <Route path="/result-set-master" element={<ResultSetMasterPage />} />
        <Route path="/answer-master/:setId" element={<AnswerMasterPage />} />
        <Route path="/result-master/:setId" element={<ResultMasterPage />} />
        <Route path="/response-aggregation" element={<ResponseAggregationPage />} />
      </Routes>
    </>
  );
};

export default App;
