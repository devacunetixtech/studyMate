import React from 'react';

const LogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>
  </svg>
);

export default function LandingPage({ onStart }) {
  return (
    <div className="landing-container">
      {/* ── Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav__logo">
          <div className="landing-nav__logo-icon">
            <LogoIcon />
          </div>
          <span className="landing-nav__logo-text">StudyMate</span>
        </div>
        <button className="btn btn--primary" onClick={onStart}>
          Open App
        </button>
      </nav>

      {/* ── Hero Section */}
      <header className="landing-hero">
        <span className="landing-hero__badge">MEET YOUR ACADEMIC COMPANION</span>
        <h1 className="landing-hero__title">
          Master Your Courses with <span className="text-gradient">StudyMate</span>
        </h1>
        <p className="landing-hero__description">
          An intelligent exam-preparation assistant powered by advanced AI. Upload your lectures, slides, and textbooks to generate structured summaries, get grounded answers to tough questions, and query search-backed learning resources.
        </p>
        <button className="btn btn--hero" onClick={onStart}>
          Get Started for Free &rarr;
        </button>
      </header>

      {/* ── Features Grid */}
      <section className="landing-features">
        <h2 className="section-title">Designed for Smart Students</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-card__icon">📝</div>
            <h3 className="feature-card__title">Exam-Focused Summaries</h3>
            <p className="feature-card__text">
              Transform long manuals and slides into structured bullet points. StudyMate extracts high-yield information and focus areas tailored for university students.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon">💬</div>
            <h3 className="feature-card__title">Grounded Q&A</h3>
            <p className="feature-card__text">
              Ask questions about your uploaded syllabus or lecture notes and get precise, factual answers referenced directly to your materials. No hallucinated facts.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon">🔍</div>
            <h3 className="feature-card__title">Deep Search (RAG)</h3>
            <p className="feature-card__text">
              Query multiple documents simultaneously. Ask for extra reading, and StudyMate will use live Google Search integration to find credible, peer-reviewed articles.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card__icon">🎤</div>
            <h3 className="feature-card__title">Hands-Free Voice Q&A</h3>
            <p className="feature-card__text">
              Study dynamically with speech-to-text input. Speak your questions naturally, watch them translate instantly, and get interactive audio-assisted learning.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} StudyMate. Built for academic excellence.</p>
      </footer>
    </div>
  );
}
