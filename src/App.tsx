import { useState } from 'react';
import Home from './pages/Home';
import Workspace from './components/workspace/Workspace';

type View = 'home' | 'studio';

export default function App() {
  const [view, setView] = useState<View>('home');

  if (view === 'home') {
    return <Home onEnter={() => setView('studio')} />;
  }
  return <Workspace onExit={() => setView('home')} />;
}
