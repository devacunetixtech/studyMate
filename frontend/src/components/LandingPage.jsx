import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FileText, MessageSquare, Search, Mic, ArrowRight, Sparkles, Sun, Moon, CheckSquare, Square, CornerDownLeft } from 'lucide-react';

export default function LandingPage({ onStart, theme, toggleTheme }) {
  // Stagger container for hero content
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05,
      },
    },
  };

  // Fade up animation for elements
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1], // easeOutExpo
      },
    },
  };

  // Feature cards stagger trigger
  const gridVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  // Interactive Checklist Asset State
  const [checklist, setChecklist] = useState([
    { id: 1, text: "Outer Membrane: permeable", checked: true },
    { id: 2, text: "Inner Membrane: cristae folds", checked: true },
    { id: 3, text: "ATP Synthesis: proton gradient", checked: false },
  ]);

  const toggleCheck = (id) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  // Hero title text to split and stagger
  const titleText = "Master Your Courses with StudyMate";
  const words = titleText.split(" ");

  return (
    <div className="landing-container">
      {/* ── Artsy Minimalist Floating Background */}
      <div className="artsy-bg">
        <motion.div
          className="artsy-glow artsy-glow--1"
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="artsy-glow artsy-glow--2"
          animate={{
            x: [0, -25, 40, 0],
            y: [0, 30, -30, 0],
            scale: [1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* ── Navbar */}
      <motion.nav
        className="landing-nav"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="landing-nav__logo">
          <motion.div
            className="landing-nav__logo-icon"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <BookOpen size={18} strokeWidth={2.2} />
          </motion.div>
          <span className="landing-nav__logo-text">StudyMate</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <motion.button
            className="btn btn--icon"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ borderRadius: '50%', padding: '8px', flexShrink: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </motion.button>
          <motion.button
            className="btn btn--ghost"
            onClick={onStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Open App
          </motion.button>
        </div>
      </motion.nav>

      {/* ── Hero Section */}
      <motion.header
        className="landing-hero"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Left Column: Copy & Actions */}
        <div className="landing-hero__content">
          <motion.div variants={itemVariants}>
            <span className="landing-hero__badge">
              <Sparkles size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
              Meet your academic companion
            </span>
          </motion.div>

          <motion.h1 className="landing-hero__title" variants={itemVariants}>
            {words.map((word, index) => {
              const isStudyMate = word.includes("StudyMate");
              return (
                <span key={index} style={{ display: 'inline-block', marginRight: '0.22em', overflow: 'hidden', verticalAlign: 'top' }}>
                  <motion.span
                    style={{ display: 'inline-block' }}
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: index * 0.04 + 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className={isStudyMate ? "text-gradient" : ""}
                  >
                    {word}
                  </motion.span>
                </span>
              );
            })}
          </motion.h1>

          <motion.p className="landing-hero__description" variants={itemVariants}>
            An intelligent exam-preparation assistant designed with pure minimalism. Upload your lecture slides, notes, and textbooks to generate structured summaries, get direct factual answers, and query web-backed learning materials.
          </motion.p>

          <motion.div variants={itemVariants}>
            <motion.button
              className="btn btn--hero"
              onClick={onStart}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Get Started <ArrowRight size={16} style={{ marginLeft: 6, verticalAlign: 'middle', display: 'inline' }} />
            </motion.button>
          </motion.div>
        </div>

        {/* Right Column: Artsy Interactive Assets Stack */}
        <motion.div 
          className="hero-preview-stack"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        >
          {/* Card A: Interactive Summary Checklist Card */}
          <motion.div
            className="preview-card preview-card--summary"
            drag
            dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
            whileDrag={{ scale: 1.03, zIndex: 10 }}
            animate={{
              y: [0, -12, 0],
            }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <FileText size={13} style={{ color: 'var(--accent-amber)' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>
                Active Summary
              </span>
            </div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>
              Mitochondria Overview
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {checklist.map(item => (
                <div 
                  key={item.id} 
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleCheck(item.id)}
                >
                  <motion.div whileTap={{ scale: 0.85 }}>
                    {item.checked ? (
                      <CheckSquare size={13} style={{ color: 'var(--accent-gold)' }} />
                    ) : (
                      <Square size={13} style={{ color: 'var(--border-hover)' }} />
                    )}
                  </motion.div>
                  <span style={{
                    fontSize: '0.78rem',
                    color: item.checked ? 'var(--text)' : 'var(--muted)',
                    textDecoration: item.checked ? 'line-through' : 'none',
                    opacity: item.checked ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: '0.65rem', color: 'var(--muted)', textAlign: 'right', fontStyle: 'italic' }}>
              ✦ Drag to move me
            </div>
          </motion.div>

          {/* Card B: AI Grounded Q&A Card */}
          <motion.div
            className="preview-card preview-card--chat"
            drag
            dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
            whileDrag={{ scale: 1.03, zIndex: 10 }}
            animate={{
              y: [0, 10, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-amber))',
                display: 'flex', alignItems: 'center', justify: 'center'
              }}>
                <Sparkles size={8} style={{ color: '#000' }} />
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)' }}>StudyMate</span>
              <span className="badge" style={{ fontSize: '0.6rem', padding: '0px 6px' }}>AI</span>
            </div>
            <p style={{ fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text)', marginBottom: 8 }}>
              Based on slide 14, cellular respiration occurs in two distinct pathways...
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                fontSize: '0.65rem', background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', color: 'var(--muted)'
              }}>
                📄 biochem_lecture.pdf
              </span>
            </div>
          </motion.div>
        </motion.div>
      </motion.header>

      {/* ── Features Grid */}
      <section className="landing-features">
        <motion.h2
          className="section-title"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
        >
          Designed for Smart Students
        </motion.h2>

        <motion.div
          className="features-grid"
          variants={gridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {/* Feature 1 */}
          <motion.div className="feature-card" variants={cardVariants}>
            <div className="feature-card__icon">
              <FileText size={20} />
            </div>
            <h3 className="feature-card__title">Exam-Focused Summaries</h3>
            <p className="feature-card__text">
              Transform long manuals and lecture slides into high-yield, structured bullet points. Extract critical formulas, terminology, and core focus areas.
            </p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div className="feature-card" variants={cardVariants}>
            <div className="feature-card__icon">
              <MessageSquare size={20} />
            </div>
            <h3 className="feature-card__title">Grounded Q&A</h3>
            <p className="feature-card__text">
              Ask questions about your uploaded materials and receive precise, factual answers referenced directly to specific sections of your files.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div className="feature-card" variants={cardVariants}>
            <div className="feature-card__icon">
              <Search size={20} />
            </div>
            <h3 className="feature-card__title">Deep Search (RAG)</h3>
            <p className="feature-card__text">
              Query multiple documents simultaneously. Automatically cross-reference external, peer-reviewed academic articles to enrich your learning.
            </p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div className="feature-card" variants={cardVariants}>
            <div className="feature-card__icon">
              <Mic size={20} />
            </div>
            <h3 className="feature-card__title">Voice Q&A</h3>
            <p className="feature-card__text">
              Interact hands-free with speech-to-text. Speak your study questions naturally, view instant translations, and study with auditive assistance.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} StudyMate. Refined academic excellence.</p>
      </footer>
    </div>
  );
}
