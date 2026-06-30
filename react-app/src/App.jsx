import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Blog from './pages/Blog';
import { useTheme } from './hooks/useTheme';

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>&copy; 2026 CRONZPH. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <BrowserRouter>
      <Navbar theme={theme} onToggleTheme={toggle} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/blog" element={<Blog />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
