import { Link } from 'react-router-dom';
import { ArrowRight, Database, ShieldCheck, FlaskConical, Stethoscope } from 'lucide-react';
import { EmergencyNotice } from '../../components/patient/PatientNav';

/**
 * Patient Mode "About" page.
 *
 * Explains what MedGuard is, what it was built on, and what it is not —
 * without pulling the research dashboard into the patient experience.
 */
export default function PatientAboutPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <span className="text-[11px] font-mono text-muted uppercase tracking-wider">Patient Mode · About</span>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">About MedGuard</h1>
        <p className="text-sm text-secondary max-w-2xl leading-relaxed">
          MedGuard — Triage One — is a research and teaching prototype for explainable machine
          learning in emergency triage. This page explains what it is and, just as importantly, what
          it is not.
      </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface shadow-sm p-5 sm:p-7">
        <h2 className="text-lg font-extrabold tracking-tight text-primary flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-primary" aria-hidden="true" />
          What it is
        </h2>
        <p className="mt-3 text-sm text-secondary leading-relaxed">
          MedGuard takes a set of triage observations — the kind of details a clinician records when
          someone arrives at an emergency department — and estimates where that presentation would
          sit on the five-level Emergency Severity Index (ESI) scale. The ESI is a standardised
          triage tool developed with the US Agency for Healthcare Research and Quality, running
          from level 1 (most urgent) to level 5 (least urgent).
        </p>
        <p className="mt-3 text-sm text-secondary leading-relaxed">
          The point of the project is to explore how a machine-learning model&rsquo;s reasoning can
          be explained to a non-technical reader without hiding the fact that the model is
          uncertain.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface shadow-sm p-5 sm:p-7">
        <h2 className="text-lg font-extrabold tracking-tight text-primary flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" aria-hidden="true" />
          The data behind it
        </h2>
        <p className="mt-3 text-sm text-secondary leading-relaxed">
          The model was trained on <strong className="text-primary">Triagegeist</strong>, a
          synthetic dataset of 80,000 fictional emergency-department records. Every value in it was
          generated. No real patient contributed any information to this project.
        </p>
        <p className="mt-3 text-sm text-secondary leading-relaxed">
          Because the training data is synthetic, the model&rsquo;s performance figures describe
          how well it learned made-up data. They say nothing about how it would perform on real
          patients.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface shadow-sm p-5 sm:p-7">
        <h2 className="text-lg font-extrabold tracking-tight text-primary flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
          What it is not
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-secondary">
          {[
            'It is not a medical device, is not clinically validated, and has not been approved for any clinical use.',
            'It does not diagnose conditions, suggest treatment, or estimate how long someone will wait.',
            'It cannot determine that someone is safe to wait or to remain at home.',
            'It works on synthetic data only and has never been tested against real patient records.',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-error mt-0.5" aria-hidden="true">✕</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface-soft/60 p-5 sm:p-7">
        <h2 className="text-lg font-extrabold tracking-tight text-primary flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary" aria-hidden="true" />
          If you need help now
        </h2>
        <p className="mt-3 text-sm text-secondary leading-relaxed">
          If someone may be experiencing a medical emergency, contact your local emergency number.
          Do not wait for a MedGuard result, and do not use one to decide whether to seek care.
        </p>
        <div className="mt-4">
          <EmergencyNotice />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/assessment"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-contrast text-sm font-semibold px-5 py-3 rounded-xl shadow-md shadow-primary/15 transition"
        >
          Start an assessment <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
