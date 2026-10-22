import { Link } from 'react-router-dom';
import {
  ArrowRight, ClipboardList, HeartPulse, Info, ShieldCheck, Sparkles, HelpCircle,
} from 'lucide-react';
import { EmergencyNotice } from '../../components/patient/PatientNav';

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Tell us the basics',
    body: 'Age, and the general area of the problem. Anything you are unsure about can be left blank.',
  },
  {
    icon: HeartPulse,
    title: 'Share what is known',
    body: 'Pain level, and any measurements that were taken — blood pressure, oxygen level, temperature and so on.',
  },
  {
    icon: Sparkles,
    title: 'Review and see the result',
    body: 'Check every detail, then run the assessment and read the result in plain language.',
  },
];

/**
 * Patient Mode landing page.
 *
 * Deliberately free of model scores, charts and research metrics: a visitor
 * arrives here to understand an assessment result, not to evaluate a model.
 */
export default function PatientHomePage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-surface to-surface px-5 sm:px-10 py-10 sm:py-14 shadow-sm">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-surface border border-border px-3 py-1 text-[11px] font-semibold text-primary">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Research prototype · synthetic data
          </div>

          <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-primary leading-[1.1]">
            Understand your assessment results in a clearer, simpler way.
          </h1>

          <p className="mt-4 text-base sm:text-lg text-secondary leading-relaxed">
            MedGuard is a research prototype that explores how triage information can be organized
            and explained. It is <strong className="text-primary">not a medical diagnosis</strong>{' '}
            and <strong className="text-primary">not a substitute for professional medical care</strong>.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/assessment"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-contrast font-semibold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-primary/20 transition"
            >
              Start Assessment <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 font-semibold text-sm text-primary hover:text-primary-hover px-6 py-3.5 rounded-xl border border-border bg-surface hover:bg-surface-soft transition"
            >
              <HelpCircle className="w-4 h-4" aria-hidden="true" /> How it works
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-24">
        <h2 id="how-it-works-heading" className="text-2xl font-extrabold tracking-tight text-primary">
          How the assessment works
        </h2>
        <p className="mt-2 text-sm text-secondary max-w-2xl leading-relaxed">
          Three short steps, about two minutes. You can stop and come back at any point — your
          answers stay on this page until you submit them.
        </p>

        <ol className="mt-6 grid sm:grid-cols-3 gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-primary-soft text-primary-muted flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-mono text-muted uppercase tracking-wider">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-primary">{step.title}</h3>
                <p className="mt-1.5 text-sm text-secondary leading-relaxed">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* What you will and will not get */}
      <section aria-labelledby="expect-heading" className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
          <h2 id="expect-heading" className="text-lg font-extrabold tracking-tight text-primary">
            What you will get
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5" aria-hidden="true">✓</span>
              An estimated triage level, explained in plain language.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5" aria-hidden="true">✓</span>
              A clear list of the details that were used, and the ones that were missing.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5" aria-hidden="true">✓</span>
              A plain-language account of what the model took into account.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
          <h2 className="text-lg font-extrabold tracking-tight text-primary">
            What you will not get
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-error mt-0.5" aria-hidden="true">✕</span>
              A diagnosis, a treatment plan, or medication advice.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-error mt-0.5" aria-hidden="true">✕</span>
              A judgement about whether it is safe to wait or to stay at home.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-error mt-0.5" aria-hidden="true">✕</span>
              Any assessment of a real person — this prototype works on synthetic data only.
            </li>
          </ul>
        </div>
      </section>

      {/* Disclaimer + emergency */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface-soft/60 p-5 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-secondary leading-relaxed">
            <strong className="text-primary">About this prototype.</strong> MedGuard was built as a
            research and teaching project. The underlying model was trained on the Triagegeist
            synthetic dataset, has not been clinically validated, and is not approved for any
            clinical use.
          </p>
        </div>
        <EmergencyNotice />
      </section>
    </div>
  );
}
