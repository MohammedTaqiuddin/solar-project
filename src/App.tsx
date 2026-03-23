import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Predictions from './components/Predictions';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'predictions'>('dashboard');

  return (
    <>
      {activeTab === 'dashboard' ? (
        <Dashboard activeTab={activeTab} onTabChange={setActiveTab} />
      ) : (
        <Predictions activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </>
  );
}

export default App;