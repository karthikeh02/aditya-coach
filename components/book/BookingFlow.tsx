"use client";
import Image from "next/image";

/**
 * /book — 3-state conversion machine (client island).
 *
 * STATE A (pre-payment):  Hero (§1) + What happens on the call (§2) +
 *                         Intake form (§3) + Payment block (§4) + FAQ (§7).
 * STATE B (post-payment): Success banner (§6) + optional intake (§5).
 * STATE C (finished):     Banner persists + compact "You're all set".
 *
 * Only one state is visible at a time; the others carry hidden + aria-hidden.
 * The container reserves min-height so state swaps cause no layout shift.
 * Focus moves to the new state's heading on every transition; changes are
 * announced via a visually-hidden aria-live="assertive" region.
 */

/* ==========================================================================
   PHASE-2 STUB CHECKLIST — every seam below is a Phase-2 no-op stub that
   lives in @/lib/config (imported, never redefined). Phase 1 ships fully
   working UI on these stubs:
   [ ] startPayment        → real Razorpay checkout (BOOKING.RAZORPAY_KEY,
                             amount PRICE_INR × 100, prefill name/email/contact,
                             verify signature server-side).
   [ ] sendToEmailProvider → Brevo/Mailchimp (booking + intake payload,
                             welcome/confirmation email).
   [ ] notifyCoach         → coach WhatsApp/email notification of new booking.
   [ ] track('Purchase',…) → real analytics ID + Purchase conversion event
                             (value 2000, currency INR).
   [ ] /thank-you?type=booking redirect — wired via BOOKING.THANKYOU_URL but
       intentionally left as a COMMENT in finishIntake() below; keep the
       ?type=booking param so /thank-you can branch booking vs lead-magnet.
   [ ] COACH_WHATSAPP real number (align with global FAB) — from lib/config.
   ========================================================================== */

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import Reveal from "@/components/Reveal";
import SplitHeading from "@/components/SplitHeading";
import PlaceholderImage from "@/components/PlaceholderImage";
import VideoFrame from "@/components/home/VideoFrame";
import { CheckIcon } from "@/components/icons";
import {
  COACH_WHATSAPP,
  RAZORPAY_KEY,
  notifyCoach,
  sendToEmailProvider,
  startPayment,
  track,
  waLink,
} from "@/lib/config";
import { CONSULT_INCLUDES, LEGAL } from "@/lib/legal";

// ==== BOOKING CONFIG (swap in Phase 2) ====
const BOOKING = {
  PRICE_INR: LEGAL.CONSULT_PRICE_INR, // consultation fee — single source of truth in lib/legal.ts
  CURRENCY: "INR",
  DURATION_MIN: 45,
  COACH_WHATSAPP, // [review] Aditya's WhatsApp (same number as global FAB — set once in lib/config)
  RAZORPAY_KEY: RAZORPAY_KEY || "rzp_test_PLACEHOLDER", // Phase 2
  REDIRECT_ON_FINISH: false, // Phase-1 toggle for the /thank-you redirect (wired in finishIntake) — false ⇒ STATE C stands alone
  THANKYOU_URL: "/thank-you?type=booking",
};

// Page-level JSON-LD (Service + BreadcrumbList) is emitted by
// app/book/page.tsx (Server Component) — not from this island.

// ---------------------------------------------------------------------------
// §2 copy — WHAT WE ANALYSE (audit scope) told in the Right Order voice
// (Lifestyle → Nutrition → Supplements → Medical, always doctor-led)
// ---------------------------------------------------------------------------

const CALL_POINTS = [
  {
    lead: "We start with how you live." /* [review] */,
    body: "Sleep, energy, daily habits, health — the layer everything else is built on. We map it first, always." /* [review] */,
    Icon: SunriseGlyph,
  },
  {
    lead: "Then fitness and food — in that order." /* [review] */,
    body: "How you train and what you eat, looked at only once the lifestyle is clear. Never before." /* [review] */,
    Icon: PlateGlyph,
  },
  {
    lead: "You get the order, not a crash plan." /* [review] */,
    body: "Exactly what to change and in what sequence — lifestyle, nutrition, then supplements and medical last, always under a doctor." /* [review] */,
    Icon: CapsuleGlyph,
  },
  {
    lead: "And how you show up." /* [review] */,
    body: "Confidence, presence, and the goals that matter to you — so you leave knowing your starting point and your first moves." /* [review] */,
    Icon: ShieldGlyph,
  },
];

const GOAL_OPTIONS = [
  "Fat loss",
  "Muscle gain",
  "Energy",
  "Confidence",
  "Overall lifestyle change",
];

// ---------------------------------------------------------------------------
// §7 FAQ — single list, rendered in /book's <details> card design.
// First three are /book's own payment-gate questions. The rest are carried
// over VERBATIM from /programs (same answers men ask before starting), so a
// visitor who lands straight on /book from Instagram never has to leave to
// get them answered.
//
// /programs' "What's your refund policy?" is deliberately NOT duplicated —
// "Can I get a refund?" below is the same answer and the same /refund link.
// ---------------------------------------------------------------------------

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "Is the payment safe?",
    /* [review] */
    a: "Yes. Payment is handled by Razorpay over an encrypted connection. Aditya never sees your card details.",
  },
  {
    q: "Can I get a refund?",
    /* [review] */
    a: (
      <>
        Refunds are covered by our clear refund policy — no surprises.{" "}
        <Link
          href="/refund"
          className="underline underline-offset-2 hover:text-secondary"
        >
          Read it here
        </Link>
        .
      </>
    ),
  },
  {
    q: "What if I can't make the time?",
    /* [review] */
    a: (
      <>
        No problem.{" "}
        <a
          href={waLink(
            "Hi Aditya, I booked the Transformation Audit but need help with the time slot.", /* [review] */
            COACH_WHATSAPP,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-secondary"
        >
          Message Aditya on WhatsApp
        </a>{" "}
        and we&apos;ll reschedule. The slot is flexible — the decision to start
        is the part that matters.
      </>
    ),
  },
  // ---- carried over from /programs (copy verbatim) ----
  {
    q: "Is this online, or do I have to be in Kolkata?",
    a: "Both work. I'm based in Kolkata and coach men in person and worldwide online. The Transformation Audit is a 45-minute call over WhatsApp, so it doesn't matter where you are.",
  },
  {
    q: "Do you take international clients?",
    a: "Yes. I coach men worldwide online. The call, the check-ins and your plan all run remotely — nothing about the process needs you in the same city.",
  },
  {
    q: "What if I'm a complete beginner?",
    a: "Good. Beginners get the cleanest results because there's nothing to un-learn. We fix your lifestyle first — how you sleep, wake, move and eat — before anything advanced. You don't need a gym background to start.",
  },
  {
    q: "How soon will I see results?",
    a: "Some things shift in the first two weeks — energy, sleep, focus. Visible body change takes longer and depends on your starting point and how consistently you execute. I don't sell overnight transformations. I build change that lasts. Individual results vary.",
  },
];

// ---------------------------------------------------------------------------
// §3 validation (JS owns validation — <form noValidate>)
// ---------------------------------------------------------------------------

type FieldName = "name" | "phone" | "email" | "age" | "goal";
const FIELD_ORDER: FieldName[] = ["name", "phone", "email", "age", "goal"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/; // single @, valid domain, no spaces

function validateField(field: FieldName, raw: string): string | null {
  const v = raw.trim();
  switch (field) {
    case "name":
      // required; ≥ 2 chars; not digits-only
      if (v.length < 2 || /^[\d\s]+$/.test(v)) return "Please enter your full name.";
      return null;
    case "phone": {
      // strip spaces/dashes; optional leading +; 10–15 digits;
      // India default: a bare 10-digit number must start 6–9
      const cleaned = v.replace(/[\s-]/g, "");
      const m = /^\+?(\d{10,15})$/.exec(cleaned);
      const ok =
        !!m &&
        (cleaned.startsWith("+") || m[1].length !== 10 || /^[6-9]/.test(m[1]));
      return ok
        ? null
        : "Enter a valid WhatsApp number (10 digits, or +country code).";
    }
    case "email":
      return EMAIL_RE.test(v) ? null : "Enter a valid email address.";
    case "age": {
      const n = Number(v);
      if (!v || !Number.isInteger(n) || n < 18 || n > 99)
        return "Enter your age (18–99)."; /* [review] confirm minimum age 18 */
      return null;
    }
    case "goal":
      return v ? null : "Select your main goal.";
  }
}

// ---------------------------------------------------------------------------
// Enter animation helper — reuses the global .reveal / .is-in classes so state
// entrances are opacity/translateY only and degrade under reduced motion
// (globals.css zeroes transition durations for prefers-reduced-motion).
// Classes are applied straight to the DOM node (external system) so no state
// updates happen inside the effect.
// ---------------------------------------------------------------------------

function useEnterAnimation(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    el.classList.add("reveal"); // hide only now that we can animate back in
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => el.classList.add("is-in"));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      el.classList.remove("reveal", "is-in");
    };
  }, [active]);
  return ref;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type MachineState = "A" | "B" | "C";

export default function BookingFlow() {
  const [state, setState] = useState<MachineState>("A");

  // §3 pre-payment intake values + errors
  const [values, setValues] = useState<Record<FieldName, string>>({
    name: "",
    phone: "",
    email: "",
    age: "",
    goal: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const fieldRefs = useRef<
    Record<FieldName, HTMLInputElement | HTMLSelectElement | null>
  >({ name: null, phone: null, email: null, age: null, goal: null });

  // §4 payment state
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(false);

  // §5 post-payment intake (all optional)
  const [intake, setIntake] = useState({
    occupation: "",
    lifestyle: "",
    training: "",
    blocker: "",
    success: "",
  });

  // a11y: live announcements + focus targets
  const [liveMsg, setLiveMsg] = useState("");
  const bannerHeadingRef = useRef<HTMLHeadingElement>(null);
  const finishedHeadingRef = useRef<HTMLHeadingElement>(null);

  // Enter animations (opacity/transform only, reduced-motion safe)
  const postPayRef = useEnterAnimation(state !== "A");
  const finishedRef = useEnterAnimation(state === "C");

  // Focus management on every state transition (DOM only — the aria-live
  // announcement text is set in the event handlers, not here)
  useEffect(() => {
    if (state === "A") return;
    const target =
      state === "B" ? bannerHeadingRef.current : finishedHeadingRef.current;
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: state === "B" ? "start" : "center",
      });
    }
  }, [state]);

  function setValue(field: FieldName) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const next = e.target.value;
      setValues((v) => ({ ...v, [field]: next }));
      // clear a field's error on input
      setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };
  }

  function blurValidate(field: FieldName) {
    return () => {
      const err = validateField(field, values[field]);
      setErrors((prev) => ({ ...prev, [field]: err ?? undefined }));
    };
  }

  function scrollToIntake(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    document.getElementById("intake")?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  // §4 — the intake form's submit button IS the payment gate (single-step UX)
  async function handlePaySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (paying) return; // prevent double-submit

    const nextErrors: Partial<Record<FieldName, string>> = {};
    for (const f of FIELD_ORDER) {
      const err = validateField(f, values[f]);
      if (err) nextErrors[f] = err;
    }
    setErrors(nextErrors);
    const firstBad = FIELD_ORDER.find((f) => nextErrors[f]);
    if (firstBad) {
      fieldRefs.current[firstBad]?.focus(); // focus the FIRST invalid field
      return;
    }

    setPayError(false);
    setPaying(true);
    track("InitiateCheckout", {
      value: BOOKING.PRICE_INR,
      currency: BOOKING.CURRENCY,
    });
    try {
      // PHASE 2 STUB — startPayment (lib/config) opens the real Razorpay
      // checkout in Phase 2 (key BOOKING.RAZORPAY_KEY, amount PRICE_INR × 100,
      // prefill {name,email,contact}, signature verified server-side).
      // Phase 1: resolves { ok: true } immediately — happy path.
      const res = await startPayment({
        amount: BOOKING.PRICE_INR * 100,
        currency: BOOKING.CURRENCY,
        name: values.name.trim(),
        email: values.email.trim(),
        contact: values.phone.trim(),
        goal: values.goal,
        age: values.age,
      });
      if (res.ok) {
        // Fired ONCE here on payment success (not again in the §6 banner).
        // PHASE 2 STUB — track() is a no-op until analytics IDs exist.
        track("Purchase", {
          value: BOOKING.PRICE_INR,
          currency: BOOKING.CURRENCY,
        });
        // PHASE 2 STUB — notifyCoach() is a no-op; later: WhatsApp/email ping.
        notifyCoach({ type: "booking_paid", ...values });
        setState("B");
        setLiveMsg(
          "Payment received. Your audit is booked — Aditya will contact you on WhatsApp within 24 hours.",
        );
      } else {
        setPayError(true); // Phase-2 real path: declined / closed checkout
      }
    } catch {
      setPayError(true);
    } finally {
      setPaying(false);
    }
  }

  // §5 — both buttons proceed to STATE C
  function finishIntake() {
    // PHASE 2 STUB — sendToEmailProvider() + notifyCoach() are no-ops in
    // Phase 1; later they deliver the booking + intake payload to the coach.
    void sendToEmailProvider({
      email: values.email.trim(),
      source: "booking",
      name: values.name.trim(),
      phone: values.phone.trim(),
      age: values.age,
      goal: values.goal,
      ...intake,
    });
    notifyCoach({ type: "booking_intake", ...intake });
    setState("C");
    setLiveMsg("You're all set. See you on WhatsApp."); /* [review] */
    // OPTIONAL REDIRECT — functional toggle per spec STATE C. Disabled in
    // Phase 1 (STATE C stands alone as the final confirmation); flip
    // BOOKING.REDIRECT_ON_FINISH to true to send users to
    // /thank-you?type=booking instead.
    if (BOOKING.REDIRECT_ON_FINISH) window.location.assign(BOOKING.THANKYOU_URL);
  }

  function handleIntakeSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    finishIntake();
  }

  const stateA = state === "A";
  // Heading-tree integrity: STATE A's hero owns the page h1; once the B/C
  // wrapper becomes the visible content its banner heading must take over as
  // the single exposed h1 (the A wrapper is hidden + aria-hidden). Prerendered
  // HTML (STATE A) still contains exactly one h1.
  const BannerHeading = stateA ? "h2" : ("h1" as const);

  return (
    /* min-height reserved so state swaps cause no layout shift (CLS < 0.1) */
    <div id="book" className="min-h-[640px]">
      {/* visually-hidden announcer for state changes */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {liveMsg}
      </div>

      {/* ================= STATE A — PRE-PAYMENT ================= */}
      <div hidden={!stateA} aria-hidden={!stateA}>
        {/* The steps of the flow (hero → what happens → intake → payment) are
            wrapped so a single gold thread can stitch them down the left gutter
            as one continuous line to the signature. */}
        <div className="relative">
          {/* ---------- §1 HERO (tight, single-column, conversion-first) ---------- */}
          <section className="section aurora velvet relative overflow-hidden">
          <div className="container-site">
            <div className="mx-auto max-w-[62ch] text-center">
              {/* IMG_BOOK_HERO intentionally omitted — hero is pure type on
                  --bg-void (spec allows); the H1 is the LCP element. */}
              {/* Hero H1 is NEVER animated — paints at final state frame 1 */}
              <h1 className="type-h1 text-primary">
                Book Your Transformation Audit.
              </h1>
              {/* [review] Client direction doc (2026-07-21) reframes this route as
                  the Transformation Audit and supersedes the A6 sitemap H1
                  ("Book Your Consultation.") — price lives in the sub +
                  button. One H1 only. */}
              <Reveal delayMs={0}>
                <p className="type-lead mt-5 text-secondary">
                  45 minutes on WhatsApp. Tell me where you&apos;re starting
                  from.
                </p>
              </Reveal>
              {/* [review] micro-trust row */}
              <Reveal delayMs={60}>
                <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 type-small text-muted">
                  <li>
                    <span aria-hidden="true">🔒</span> Secure payment
                  </li>
                  <li>
                    <span aria-hidden="true">📱</span> On WhatsApp
                  </li>
                  <li>
                    <span aria-hidden="true">↩︎</span>{" "}
                    <Link
                      href="/refund"
                      className="underline underline-offset-2 hover:text-secondary"
                    >
                      Read the refund policy
                    </Link>
                  </li>
                </ul>
              </Reveal>
              <Reveal delayMs={120}>
                <div className="mt-8">
                  {/* [review] hero primary action label */}
                  <a
                    href="#intake"
                    onClick={scrollToIntake}
                    className="btn-gold w-full sm:w-auto"
                  >
                    Start Your Transformation
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------- §1b THE FILM ----------
             Same asset as the home page's "In my words" band (one file, one
             swap in components/home/VideoFrame.tsx) — presented differently
             here: home centres it as a standalone moment, /book runs it as an
             asymmetric two-column band directly under the hero so it reads as
             "know who you're paying before you pay", never as a detour.
             Deliberately BELOW the hero CTA: the H1 stays the LCP and the
             gold button stays above the fold on mobile. */}
        <section className="cv-auto border-t border-hairline-soft bg-alt">
          <div className="container-site section">
            <div className="mx-auto grid max-w-[1000px] items-center gap-8 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
              <div>
                <Reveal className="flex items-center gap-3">
                  <span aria-hidden="true" className="thread-h sd-draw h-px w-10" />
                  <p className="eyebrow">BEFORE YOU BOOK{/* [review] */}</p>
                </Reveal>
                {/* [review] */}
                <SplitHeading
                  as="h2"
                  text="Ninety seconds, from me."
                  className="type-h2 mt-4 text-primary"
                />
                <Reveal delayMs={80}>
                  {/* [review] */}
                  <p className="type-lead mt-4 text-secondary">
                    Watch it before you pay. You will know exactly what the
                    audit is, what we go through, and how I work.
                  </p>
                </Reveal>
              </div>
              <Reveal delayMs={160} className="reveal-blur">
                <VideoFrame
                  label="FILM — IN MY WORDS"
                  w={1280}
                  h={720}
                  runtime="90 SEC"
                  alt="Aditya Kumar Upadhyay speaking directly to camera in a warm, low-lit room, mid-sentence, explaining that his coaching builds grooming, presence, communication and confidence rather than gym and diet plans."
                  caption="One take, no script — what the audit is, in his own words."
                  /* [review] caption */
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------- §2 WHAT HAPPENS ON THE CALL ---------- */}
        <section className="section cv-auto">
          <div className="container-site">
            <div className="mx-auto max-w-[860px]">
              {/* [review] §2 reframed as the audit scope — what we analyse */}
              <SplitHeading
                as="h2"
                text="What we analyse"
                className="type-h2 text-primary"
              />
              <Reveal index={1}>
                {/* [review] */}
                <p className="type-lead mt-4 text-secondary">
                  45 focused minutes. No pitch. We go through every layer — how
                  you live, train, eat and carry yourself — and find the order
                  things need to change in.
                </p>
              </Reveal>
              {/* metallic gold gradient for the ordered step glyphs (decorative) */}
              <svg
                aria-hidden="true"
                focusable="false"
                width="0"
                height="0"
                className="absolute h-0 w-0"
              >
                <defs>
                  <linearGradient
                    id="book-icon-gold"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                  >
                    <stop offset="0%" className="[stop-color:var(--gold-200)]" />
                    <stop offset="45%" className="[stop-color:var(--gold-500)]" />
                    <stop offset="100%" className="[stop-color:var(--gold-100)]" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {CALL_POINTS.map((point, i) => (
                  <Reveal
                    key={point.lead}
                    index={i + 2}
                    className="card spot h-full reveal-left"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline-gold">
                      <point.Icon stroke="url(#book-icon-gold)" />
                    </span>
                    <h3 className="type-h3 mt-4 text-primary">{point.lead}</h3>
                    <p className="type-body mt-2 text-secondary">
                      {point.body}
                    </p>
                  </Reveal>
                ))}
              </div>
              <Reveal index={6}>
                {/* [review] goal line — the payoff of the audit */}
                <p className="type-lead mt-8 text-primary">
                  We identify what is actually holding you back — and what needs
                  to be fixed first.
                </p>
              </Reveal>
              <Reveal index={7}>
                {/* contextual echo of the global medical disclaimer */}
                <p className="type-caption mt-6 text-muted">
                  Aditya is a lifestyle coach, not a doctor or dietitian.
                  Medical steps are always referred to a qualified physician.
                  General guidance only; individual results vary.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------- §3 INTAKE FORM + §4 PAYMENT (one continuous form —
             the Pay button runs §3 validation first) ---------- */}
        <section id="intake" className="section scroll-mt-24">
          <div className="container-site">
            <div className="mx-auto max-w-[560px]">
              <SplitHeading
                as="h2"
                text="First, the basics."
                className="type-h2 text-primary"
              />
              <Reveal index={1}>
                {/* [review] */}
                <p className="type-body mt-3 text-secondary">
                  Five quick fields, then payment. This is how I prep before we
                  talk.
                </p>
              </Reveal>

              <form noValidate onSubmit={handlePaySubmit} className="mt-8">
                <Reveal index={2}>
                  {/* intake card: gold hairline top edge + cursor spotlight */}
                  <div className="card spot">
                    <div
                      aria-hidden="true"
                      className="gold-line -mx-6 -mt-6 mb-6 md:-mx-8 md:-mt-8 md:mb-8"
                    />
                    <div className="grid gap-5">
                  {/* 1 — Full name */}
                  <div>
                    <label htmlFor="bk-name" className="field-label">
                      Full name
                    </label>
                    <input
                      id="bk-name"
                      ref={(el) => {
                        fieldRefs.current.name = el;
                      }}
                      type="text"
                      name="name"
                      autoComplete="name"
                      className="input-dark"
                      value={values.name}
                      onChange={setValue("name")}
                      onBlur={blurValidate("name")}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby="bk-name-error"
                    />
                    <p
                      id="bk-name-error"
                      className="field-error"
                      aria-live="polite"
                    >
                      {errors.name}
                    </p>
                  </div>

                  {/* 2 — WhatsApp number (+91 prefix affordance) */}
                  <div>
                    <label htmlFor="bk-phone" className="field-label">
                      WhatsApp number
                    </label>
                    <input
                      id="bk-phone"
                      ref={(el) => {
                        fieldRefs.current.phone = el;
                      }}
                      type="tel"
                      name="phone"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+91"
                      className="input-dark"
                      value={values.phone}
                      onChange={setValue("phone")}
                      onBlur={blurValidate("phone")}
                      aria-invalid={errors.phone ? true : undefined}
                      aria-describedby="bk-phone-hint bk-phone-error"
                    />
                    {/* [review] */}
                    <p id="bk-phone-hint" className="type-caption mt-2 text-muted">
                      +91 by default — 10 digits, or include your country code.
                    </p>
                    <p
                      id="bk-phone-error"
                      className="field-error"
                      aria-live="polite"
                    >
                      {errors.phone}
                    </p>
                  </div>

                  {/* 3 — Email + DPDP-2023 consent echo */}
                  <div>
                    <label htmlFor="bk-email" className="field-label">
                      Email
                    </label>
                    <input
                      id="bk-email"
                      ref={(el) => {
                        fieldRefs.current.email = el;
                      }}
                      type="email"
                      name="email"
                      inputMode="email"
                      autoComplete="email"
                      className="input-dark"
                      value={values.email}
                      onChange={setValue("email")}
                      onBlur={blurValidate("email")}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby="bk-email-consent bk-email-error"
                    />
                    {/* [review] DPDP-2023 consent echo beside the email field */}
                    <p
                      id="bk-email-consent"
                      className="type-caption mt-2 text-muted"
                    >
                      We&apos;ll use your email and WhatsApp number only to
                      arrange and run your audit. No spam. See our{" "}
                      <Link
                        href="/privacy"
                        className="underline underline-offset-2 hover:text-secondary"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </p>
                    <p
                      id="bk-email-error"
                      className="field-error"
                      aria-live="polite"
                    >
                      {errors.email}
                    </p>
                  </div>

                  {/* 4 — Age */}
                  <div>
                    <label htmlFor="bk-age" className="field-label">
                      Age
                    </label>
                    <input
                      id="bk-age"
                      ref={(el) => {
                        fieldRefs.current.age = el;
                      }}
                      type="number"
                      name="age"
                      inputMode="numeric"
                      min={18}
                      max={99}
                      className="input-dark"
                      value={values.age}
                      onChange={setValue("age")}
                      onBlur={blurValidate("age")}
                      aria-invalid={errors.age ? true : undefined}
                      aria-describedby="bk-age-error"
                    />
                    <p
                      id="bk-age-error"
                      className="field-error"
                      aria-live="polite"
                    >
                      {errors.age}
                    </p>
                  </div>

                  {/* 5 — Main goal */}
                  <div>
                    <label htmlFor="bk-goal" className="field-label">
                      Main goal
                    </label>
                    <select
                      id="bk-goal"
                      ref={(el) => {
                        fieldRefs.current.goal = el;
                      }}
                      name="goal"
                      className="input-dark"
                      value={values.goal}
                      onChange={setValue("goal")}
                      onBlur={blurValidate("goal")}
                      aria-invalid={errors.goal ? true : undefined}
                      aria-describedby="bk-goal-error"
                    >
                      <option value="" disabled>
                        Select your main goal
                      </option>
                      {GOAL_OPTIONS.map((goal) => (
                        <option key={goal} value={goal}>
                          {goal}
                        </option>
                      ))}
                    </select>
                    <p
                      id="bk-goal-error"
                      className="field-error"
                      aria-live="polite"
                    >
                      {errors.goal}
                    </p>
                  </div>
                    </div>
                  </div>
                </Reveal>

                {/* ---------- §4 PAYMENT BLOCK ---------- */}
                <Reveal index={3}>
                  <div id="pay" className="card card-featured spot mt-8">
                    <p className="type-price text-gold-grad">{LEGAL.CONSULT_PRICE}</p>
                    {/* [review] */}
                    <p className="type-small mt-1 text-secondary">
                      · 45-minute Transformation Audit on WhatsApp
                    </p>
                    {/* Confirmed inclusions 6 Aug 2026 — copy lives in
                        lib/legal.ts (CONSULT_INCLUDES), not here. */}
                    <ul className="mt-4 grid gap-2">
                      <li className="type-small flex gap-2.5 text-secondary">
                        <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-gold-500" />
                        <span>{CONSULT_INCLUDES.GIFT_CARD}</span>
                      </li>
                      <li className="type-small flex gap-2.5 text-secondary">
                        <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-gold-500" />
                        <span>{CONSULT_INCLUDES.BLUEPRINT}</span>
                      </li>
                    </ul>
                    <p className="type-small text-gold-300 border-l border-hairline-gold mt-4 pl-4">
                      {CONSULT_INCLUDES.CREDIT}
                    </p>
                    <button
                      type="submit"
                      className="btn-gold mt-6 w-full min-h-[52px]"
                      disabled={paying}
                      aria-busy={paying || undefined}
                    >
                      {paying ? "Processing…" : `Pay ${LEGAL.CONSULT_PRICE} & Book`}
                    </button>
                    <div aria-live="polite">
                      {payError && (
                        /* [review] Phase-2 real-path failure copy */
                        <p className="field-error mt-3" role="alert">
                          Payment didn&apos;t go through. Try again or{" "}
                          <a
                            href={waLink(
                              "Hi Aditya, my payment for the Transformation Audit didn't go through.", /* [review] */
                              BOOKING.COACH_WHATSAPP,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2"
                          >
                            message Aditya on WhatsApp
                          </a>
                          .
                        </p>
                      )}
                    </div>

                    {/* trust cues */}
                    <ul className="mt-5 grid gap-2 type-small text-muted">
                      <li>
                        <span aria-hidden="true">🔒</span> Secure payment via
                        Razorpay
                      </li>
                      <li>
                        <span aria-hidden="true">📱</span> WhatsApp confirmation
                        within 24h
                      </li>
                      <li>
                        {/* [review] refund risk-reducer */}
                        If it&apos;s not the right fit, our refund policy has
                        you covered —{" "}
                        <Link
                          href="/refund"
                          className="underline underline-offset-2 hover:text-secondary"
                        >
                          read it
                        </Link>
                        .
                      </li>
                    </ul>

                    {/* IMG_RAZORPAY_BADGE — swappable placeholder; replace with
                        the real Razorpay / secure-payments lockup (180×40) in
                        Phase 2. Purely reassurance; safe to omit. */}
                    <div className="mt-5 max-w-[180px] opacity-80">
                      <Image
                       src="/razorpay.webp"
                        width={180}
                        height={40}
                        alt="Secured by Razorpay"
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                </Reveal>
              </form>
            </div>
          </div>
          </section>

          {/* The gold thread: one continuous 1px line drawing itself down the
              left gutter as you scroll, stitching hero → payment. Decorative,
              desktop only, reduced-motion → static (kit classes handle both). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden lg:block"
          >
            <div className="container-site relative h-full">
              <div className="thread-v sd-draw absolute inset-y-0 left-0" />
            </div>
          </div>
        </div>

        {/* ---------- §7 FAQ (STATE A only) ---------- */}
        <section className="section cv-auto">
          <div className="container-site">
            <div className="mx-auto max-w-[720px]">
              <Reveal index={0}>
                <h2 className="type-h2 text-primary">Quick questions.</h2>
              </Reveal>
              <div className="mt-8 grid gap-4">
                {FAQS.map((faq, i) => (
                  <Reveal key={faq.q} delayMs={(i + 1) * 60}>
                    <details className="card group spot">
                      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                        <span className="type-h3 text-primary">{faq.q}</span>
                        <span
                          aria-hidden="true"
                          className="text-xl leading-none text-gold-300 transition-transform duration-200 group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <p className="type-body mt-3 max-w-[64ch] text-secondary">
                        {faq.a}
                      </p>
                    </details>
                  </Reveal>
                ))}
              </div>

              {/* [review] ONE lateral context link (funnel discipline: /programs only) */}
              <Reveal delayMs={480}>
                <p className="mt-10 text-center type-small text-muted">
                  Wondering what comes after the call?{" "}
                  <Link
                    href="/programs"
                    className="underline underline-offset-2 hover:text-secondary"
                  >
                    See the full coaching programs
                  </Link>
                </p>
              </Reveal>
              {/* clearance so the WhatsApp FAB never covers the last link */}
              <div aria-hidden="true" className="h-10" />
            </div>
          </div>
        </section>
      </div>

      {/* ============ STATE B + C (the §6 banner persists into C) ============ */}
      <div hidden={stateA} aria-hidden={stateA}>
        <section className="section aurora velvet relative overflow-hidden">
          <div className="container-site">
            <div className="mx-auto max-w-[720px]">
              <div ref={postPayRef}>
                {/* ---------- §6 SUCCESS CONFIRMATION BANNER ---------- */}
                <div className="card card-featured">
                  <div className="flex items-start gap-4">
                    <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline-gold text-gold-300">
                      <DrawCheckIcon width={20} height={20} />
                    </span>
                    {/* [review] confirmation copy — audit framing */}
                    <BannerHeading
                      ref={bannerHeadingRef}
                      tabIndex={-1}
                      className="type-h3 scroll-mt-24 text-primary outline-none"
                    >
                      Payment received. Your audit is booked — Aditya will
                      contact you on WhatsApp within 24 hours.
                    </BannerHeading>
                  </div>
                  {/* [review] */}
                  <p className="type-body mt-4 text-secondary">
                    Save the WhatsApp thread — that&apos;s where we&apos;ll
                    confirm your time slot.
                  </p>
                  <a
                    href={waLink(
                      "Hi Aditya, I just booked my Transformation Audit.",
                      BOOKING.COACH_WHATSAPP,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-wa mt-5 w-full sm:w-auto"
                  >
                    Message Aditya now
                  </a>
                </div>

                {/* ---------- §5 POST-PAYMENT INTAKE (STATE B only) ---------- */}
                <div hidden={state !== "B"} aria-hidden={state !== "B"}>
                  {/* [review] completing the task's seed sentence in his voice */}
                  <p className="type-lead mt-10 text-secondary">
                    Payment confirmed. Two minutes now saves us fifteen on the
                    call. Tell me a little more so I walk in already knowing
                    you.
                  </p>
                  {/* [review] */}
                  <h2 className="type-h2 mt-3 text-primary">
                    A little more before we talk.
                  </h2>
                  <p className="type-caption mt-2 text-muted">
                    Everything here is optional — your booking is already
                    confirmed.
                    {/* [review] */}
                  </p>

                  <form
                    noValidate
                    onSubmit={handleIntakeSubmit}
                    className="mt-8 grid gap-5"
                  >
                    <Reveal index={0}>
                      {/* [review] label */}
                      <label htmlFor="bk2-occupation" className="field-label">
                        What do you do?
                      </label>
                      <input
                        id="bk2-occupation"
                        type="text"
                        name="occupation"
                        autoComplete="organization-title"
                        className="input-dark"
                        value={intake.occupation}
                        onChange={(e) =>
                          setIntake((v) => ({
                            ...v,
                            occupation: e.target.value,
                          }))
                        }
                      />
                    </Reveal>
                    <Reveal index={1}>
                      {/* [review] label + hint */}
                      <label htmlFor="bk2-lifestyle" className="field-label">
                        Your current lifestyle
                      </label>
                      <textarea
                        id="bk2-lifestyle"
                        name="lifestyle"
                        rows={3}
                        className="input-dark"
                        value={intake.lifestyle}
                        onChange={(e) =>
                          setIntake((v) => ({
                            ...v,
                            lifestyle: e.target.value,
                          }))
                        }
                        aria-describedby="bk2-lifestyle-hint"
                      />
                      <p
                        id="bk2-lifestyle-hint"
                        className="type-caption mt-2 text-muted"
                      >
                        Sleep, work hours, stress, movement — 2–3 lines.
                      </p>
                    </Reveal>
                    <Reveal index={2}>
                      {/* [review] label + hint */}
                      <label htmlFor="bk2-training" className="field-label">
                        Your current training / exercise
                      </label>
                      <textarea
                        id="bk2-training"
                        name="training"
                        rows={3}
                        className="input-dark"
                        value={intake.training}
                        onChange={(e) =>
                          setIntake((v) => ({ ...v, training: e.target.value }))
                        }
                        aria-describedby="bk2-training-hint"
                      />
                      <p
                        id="bk2-training-hint"
                        className="type-caption mt-2 text-muted"
                      >
                        {"Or 'none right now' — be honest."}
                      </p>
                    </Reveal>
                    <Reveal index={3}>
                      {/* [review] label */}
                      <label htmlFor="bk2-blocker" className="field-label">
                        What&apos;s stopped you until now
                      </label>
                      <textarea
                        id="bk2-blocker"
                        name="blocker"
                        rows={3}
                        className="input-dark"
                        value={intake.blocker}
                        onChange={(e) =>
                          setIntake((v) => ({ ...v, blocker: e.target.value }))
                        }
                      />
                    </Reveal>
                    <Reveal index={4}>
                      {/* [review] label */}
                      <label htmlFor="bk2-success" className="field-label">
                        What does success look like in 3–6 months?
                      </label>
                      <textarea
                        id="bk2-success"
                        name="success"
                        rows={3}
                        className="input-dark"
                        value={intake.success}
                        onChange={(e) =>
                          setIntake((v) => ({ ...v, success: e.target.value }))
                        }
                      />
                    </Reveal>

                    <div className="cta-stack mt-2">
                      <button type="submit" className="btn-gold">
                        Send &amp; Finish
                      </button>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={finishIntake}
                      >
                        Skip for now
                      </button>
                    </div>
                  </form>
                </div>

                {/* ---------- STATE C — FINISHED ---------- */}
                <div hidden={state !== "C"} aria-hidden={state !== "C"}>
                  <div ref={finishedRef} className="mt-10 text-center">
                    {/* [review] */}
                    <h2
                      ref={finishedHeadingRef}
                      tabIndex={-1}
                      className="type-h2 text-primary outline-none"
                    >
                      You&apos;re all set. See you on WhatsApp.
                    </h2>
                    <div className="mt-6 flex justify-center">
                      <a
                        href={waLink(
                          "Hi Aditya, I just booked my Transformation Audit.",
                          BOOKING.COACH_WHATSAPP,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-wa w-full sm:w-auto"
                      >
                        Chat with Aditya
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              {/* clearance so the WhatsApp FAB never covers the last button */}
              <div aria-hidden="true" className="h-10" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §2 glyphs — sunrise / plate / capsule / shield (Method-step motif rebuilt
// locally; the shared icon set has no equivalents and other routes' files are
// off-limits). Stroke-only, currentColor, decorative (aria-hidden).
// ---------------------------------------------------------------------------

function SunriseGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3v3" />
      <path d="M5.6 8.6 7 10" />
      <path d="M18.4 8.6 17 10" />
      <path d="M7 17a5 5 0 0 1 10 0" />
      <path d="M3 17h18" />
      <path d="M8 21h8" />
    </svg>
  );
}

function PlateGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M3.5 4v5" />
      <path d="M20.5 4v5" />
    </svg>
  );
}

function CapsuleGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="3.2"
        y="8.8"
        width="17.6"
        height="6.4"
        rx="3.2"
        transform="rotate(-35 12 12)"
      />
      <path d="M9.4 8.4l5.2 7.2" />
    </svg>
  );
}

function ShieldGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

// Success-banner check that draws itself in on STATE B entry. pathLength=60
// matches the kit's .stroke-draw dasharray (60), so the tick strokes on
// regardless of its geometric length; reduced motion → static (kit-handled).
function DrawCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path className="stroke-draw" pathLength={60} d="M20 6 9 17l-5-5" />
    </svg>
  );
}
