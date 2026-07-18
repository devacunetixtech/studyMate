import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FileText, MessageSquare, Search, Mic, ArrowRight, Sparkles, Sun, Moon } from 'lucide-react';

export default function LandingPage({ onStart, theme, toggleTheme }) {
  // Stagger container for hero content
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  // Fade up animation for elements
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
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
        <motion.div variants={itemVariants}>
          <span className="landing-hero__badge">
            <Sparkles size={11} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
            Meet your academic companion
          </span>
        </motion.div>

        <motion.h1 className="landing-hero__title" variants={itemVariants}>
          Master Your Courses with <span className="text-gradient">StudyMate</span>
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
