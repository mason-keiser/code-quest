import Link from "next/link";
import { JoinByPin } from "@/components/JoinByPin";
import { CodeBlock } from "@/components/CodeBlock";

const FEATURES = [
  { icon: "⚡", title: "Live multiplayer", body: "Host a game, share a 6-digit PIN, and watch answers roll in live." },
  { icon: "🐍", title: "Built for coding classes", body: "Syntax-highlighted “what does this print?” questions alongside multiple choice and true/false." },
  { icon: "✨", title: "AI question drafts", body: "Describe a topic and grade level; get an editable draft quiz in seconds." },
  { icon: "📊", title: "Teacher insights", body: "See which questions the class missed most and how each student did." },
  { icon: "🔥", title: "Streaks & power-ups", body: "Double points, 50/50, and extra time keep every round exciting." },
  { icon: "🛡️", title: "Kid-safe accounts", body: "Username-only sign-up (no email) and filtered nicknames." },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-16 py-6">
      <section className="grid w-full items-center gap-10 md:grid-cols-2">
        <div className="space-y-6">
          <h1 className="heading text-5xl leading-tight md:text-6xl">
            Quiz games that make <span className="text-indigo-400">code</span> click.
          </h1>
          <p className="text-lg text-slate-300">
            CodeQuest is a live classroom quiz game for K-12 coding instructors. Build a quiz (or let AI draft one),
            host it on the big screen, and students race to answer from any device.
          </p>
          <JoinByPin large />
          <div className="flex gap-3">
            <Link href="/signup" className="btn-primary">Create an account</Link>
            <Link href="/login" className="btn-secondary">Log in</Link>
          </div>
        </div>
        <div className="card space-y-4">
          <span className="badge">Question 3 / 10</span>
          <h2 className="heading text-2xl">What does this print?</h2>
          <CodeBlock language="python" code={`total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)`} />
          <div className="grid grid-cols-2 gap-2 font-mono text-white">
            <span className="rounded-xl bg-rose-500 px-4 py-3">▲ 3</span>
            <span className="rounded-xl bg-sky-500 px-4 py-3">◆ 4</span>
            <span className="rounded-xl bg-amber-500 px-4 py-3">● 6 ✓</span>
            <span className="rounded-xl bg-emerald-500 px-4 py-3">■ 10</span>
          </div>
        </div>
      </section>

      <section className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <div className="text-3xl">{f.icon}</div>
            <h3 className="heading mt-2 text-xl">{f.title}</h3>
            <p className="mt-1 text-slate-300">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
