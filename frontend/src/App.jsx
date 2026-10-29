import { useCallback, useEffect, useState } from 'react';
import HomePage from './pages/HomePage.jsx';
import ResultPage from './pages/ResultPage.jsx';
import { initTelegram } from './services/telegram.js';

export default function App() {
  const [inTelegram, setInTelegram] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setInTelegram(initTelegram().inTelegram);
  }, []);

  const back = useCallback(() => setResult(null), []);

  return result ? (
    <ResultPage result={result} onBack={back} />
  ) : (
    <HomePage onResolved={setResult} inTelegram={inTelegram} />
  );
}
