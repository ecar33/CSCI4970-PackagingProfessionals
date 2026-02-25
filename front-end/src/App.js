import React, { useState, useEffect } from 'react';
import logo from './logo.svg';
import './App.css';

function App() {
  const [currentStatus, setCurrentStatus] = useState(0);

  useEffect(() => {
    fetch('/api/health').then(res => res.json()).then(data => {
      setCurrentStatus(data.status);
    });
  }, []);

  return (
    <div className="App">
      <header className="App-header">

        ... no changes in this part ...

        <p>The current status is: {currentStatus}.</p>
      </header>
    </div>
  );
}

export default App;