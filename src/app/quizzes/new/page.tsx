import { QuizEditor } from "@/components/QuizEditor";

export default function NewQuizPage() {
  return (
    <div className="space-y-6">
      <h1 className="heading text-3xl">New quiz</h1>
      <QuizEditor />
    </div>
  );
}
