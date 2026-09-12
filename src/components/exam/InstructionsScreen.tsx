'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EXAM_INSTRUCTIONS,
  EXCEL_INSTRUCTIONS,
  EXCEL_PALETTE_KEY,
  EXCEL_TERMS,
  INSTRUCTION_COPY,
  PALETTE_KEY,
  TERMS,
} from '@/exam/instructions';
import { LANGUAGES, allQuestions, localised, type ExamAttempt, type Language } from '@/exam/types';
import { MetaIconMark, MockSathiLogo } from '../result/ResultArt';
import styles from './InstructionsScreen.module.css';

export interface InstructionsScreenProps {
  /** The paper about to be sat, for the figures at the top. */
  attempt: ExamAttempt;
  testName: string;
  maximumMarks: number;
  qualifyingMarks: number;
  /**
   * The authored paper these figures describe, or null for the sample one.
   *
   * Passed on to the editor so it opens the same paper, rather than resolving
   * "today's" a second time — between reading the instructions and pressing
   * Start, an admin publishing a test could otherwise change the answer, and
   * the candidate would sit a paper whose duration and marks they never saw.
   */
  testSlug?: string | null;
  /** Which language the instructions themselves open in. */
  initialLanguage?: Language;
}

/**
 * The page between choosing the sample exam and sitting it.
 *
 * It owns the language choice, because that is the last moment it can be made:
 * the paper is sat in one language and switching part-way would invalidate
 * everything already written. The instructions have their own language, so a
 * candidate can read them in Hindi and sit the paper in English.
 *
 * Nothing here is decorative. Every figure comes from the paper itself, and the
 * agreement gate really does hold the Start button shut.
 */
export function InstructionsScreen({
  attempt,
  testName,
  maximumMarks,
  qualifyingMarks,
  testSlug = null,
  initialLanguage = 'en',
}: InstructionsScreenProps) {
  const router = useRouter();

  const [readingIn, setReadingIn] = useState<Language>(initialLanguage);
  const [sittingIn, setSittingIn] = useState<Language>(initialLanguage);
  const [agreed, setAgreed] = useState(false);

  const say = (key: keyof typeof INSTRUCTION_COPY): string =>
    localised(INSTRUCTION_COPY[key], readingIn);

  /*
   * Which paper this is, read from the attempt rather than taken as a prop.
   * The attempt already carries it, and a second source would be one more thing
   * that could disagree — a Word instructions page in front of an Excel paper.
   */
  const isExcel = attempt.subject === 'excel';

  const minutes = Math.round(attempt.durationSeconds / 60);

  const facts = [
    { icon: 'clock' as const, tone: styles.toneBlue, label: say('duration'), value: `${minutes} ${say('minutes')}` },
    { icon: 'paper' as const, tone: styles.toneGreen, label: say('totalQuestions'), value: String(allQuestions(attempt).length) },
    { icon: 'star' as const, tone: styles.toneAmber, label: say('totalMarks'), value: String(maximumMarks) },
    { icon: 'target' as const, tone: styles.toneViolet, label: say('qualifyingMarks'), value: String(qualifyingMarks) },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <MockSathiLogo />

        <label className={styles.langBox}>
          <span className={styles.langLabel}>{say('instructionsLanguage')}</span>
          <select
            className={styles.langSelect}
            value={readingIn}
            onChange={(event) => setReadingIn(event.target.value as Language)}
          >
            {LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <h1 className={styles.title}>{testName}</h1>
      <p className={styles.subtitle}>{say('subtitle')}</p>

      <div className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.label} className={styles.fact}>
            <span className={`${styles.factIcon} ${fact.tone ?? ''}`} aria-hidden="true">
              <MetaIconMark name={fact.icon} />
            </span>
            <span>
              <span className={styles.factLabel}>{fact.label}</span>
              <strong className={styles.factValue}>{fact.value}</strong>
            </span>
          </div>
        ))}
      </div>

      <div className={styles.columns}>
        <section className={styles.card}>
          <h2 className={`${styles.cardHead} ${styles.headBlue}`}>
            <span className={styles.headIcon} aria-hidden="true">
              <MetaIconMark name="paper" />
            </span>
            {say('instructionsTitle')}
          </h2>
          <ol className={styles.rules}>
            {localised(isExcel ? EXCEL_INSTRUCTIONS : EXAM_INSTRUCTIONS, readingIn).map((rule, index) => (
              <li key={rule}>
                <span className={styles.ruleNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.cardHead} ${styles.headBlue}`}>
            <span className={styles.headIcon} aria-hidden="true">
              <MetaIconMark name="target" />
            </span>
            <span>
              {say('paletteTitle')}
              <span className={styles.headAside}>{say('paletteSubtitle')}</span>
            </span>
          </h2>

          <ul className={styles.key}>
            {(isExcel ? EXCEL_PALETTE_KEY : PALETTE_KEY).map((row) => (
              <li key={row.state}>
                <span className={`${styles.swatch} ${styles[row.state] ?? ''}`} aria-hidden="true" />
                <strong className={styles.keyName}>{localised(row.name, readingIn)}</strong>
                <span className={styles.keyMeaning}>{localised(row.meaning, readingIn)}</span>
              </li>
            ))}
          </ul>

          <p className={styles.keyNote}>{say(isExcel ? 'paletteNoteExcel' : 'paletteNote')}</p>
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.cardHead} ${styles.headGreen}`}>
            <span className={styles.headIcon} aria-hidden="true">
              <MetaIconMark name="paper" />
            </span>
            {say('languageTitle')}
          </h2>
          <div className={styles.cardBody}>
            <p className={styles.bodyText}>{say('languageBody')}</p>
            <label className={styles.srOnly} htmlFor="test-language">
              {say('languageTitle')}
            </label>
            <select
              id="test-language"
              className={styles.testLanguage}
              value={sittingIn}
              onChange={(event) => setSittingIn(event.target.value as Language)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.cardHead} ${styles.headAmber}`}>
            <span className={styles.headIcon} aria-hidden="true">
              <MetaIconMark name="star" />
            </span>
            {say('termsTitle')}
          </h2>
          <div className={styles.cardBody}>
            <ul className={styles.terms}>
              {localised(isExcel ? EXCEL_TERMS : TERMS, readingIn).map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>

            <label className={styles.agree}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>{say('agree')}</span>
            </label>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <Link href="/" className={styles.ghostButton}>
          <span aria-hidden="true">←</span> {say('back')}
        </Link>

        <span className={styles.footerRight}>
          {agreed ? null : <span className={styles.gateHint}>{say('agreeFirst')}</span>}
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!agreed}
            onClick={() => {
              const editor = isExcel ? '/spreadsheet' : '/editor';
              const test = testSlug ? `&test=${encodeURIComponent(testSlug)}` : '';
              router.push(`${editor}?mode=exam&lang=${sittingIn}${test}`);
            }}
          >
            {say('start')} <span aria-hidden="true">→</span>
          </button>
        </span>
      </footer>
    </div>
  );
}
