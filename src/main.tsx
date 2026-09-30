import { createRoot } from 'react-dom/client';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/vietnamese-700.css';
import './styles.css';
import { App } from './App';
import { AudioProvider } from './audio/AudioProvider';

createRoot(document.getElementById('root')!).render(
  <AudioProvider src="/audio/lan-cuoi.mp3">
    <App />
  </AudioProvider>,
);
