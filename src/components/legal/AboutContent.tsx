import styles from './LegalContent.module.css';

/** Content mirrors `About MockSathi.txt` verbatim (converted to JSX). */
export function AboutContent() {
  return (
    <div className={styles.content}>
      <p>
        MockSathi is a mock test platform built for one purpose — helping students excel in
        competitive and government exams through expert-designed practice. We are not just another
        mock test website; every test on MockSathi is created by subject-matter experts, ensuring
        each mock reflects real exam patterns and difficulty levels.
      </p>
      <p>
        Currently, MockSathi offers Word and Excel efficiency mock tests for typing and computer
        proficiency exams conducted in Rajasthan, Jharkhand, Odisha, Punjab, Haryana, and other
        state government recruitment exams. These tests are designed to help candidates practice
        under real exam conditions and improve both speed and accuracy before the actual test.
      </p>
      <p>
        We&apos;re continuously expanding. In the coming months, MockSathi will launch dedicated
        mock test series for SSC, Banking, RRB NTPC, DSSSB, and other major state-level government
        exams — giving aspirants a single, reliable platform for all their exam preparation needs.
      </p>
      <p>
        At MockSathi, our only focus is quality — high-quality mocks built by experts, so students
        can prepare with confidence and perform their best on exam day.
      </p>
    </div>
  );
}
