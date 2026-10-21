// Seeds demo accounts, a sample quiz, and one finished game (so reports have data).
// Usage: npm run seed   (reads .env.local; safe to re-run)
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, NEXT_PUBLIC_DEMO_PASSWORD: password } = process.env;
if (!url || !key || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_DEMO_PASSWORD in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const email = (u) => `${u}@users.codequest.invalid`;

const USERS = [
  { username: "demo_admin", display_name: "Admin Ada", role: "admin", avatar: "🦉" },
  { username: "demo_teacher", display_name: "Mr. Turing", role: "instructor", avatar: "🤖" },
  { username: "demo_student", display_name: "Demo Student", role: "student", avatar: "🦊" },
  { username: "maya_codes", display_name: "Maya", role: "student", avatar: "🦄" },
  { username: "leo_builds", display_name: "Leo", role: "student", avatar: "🦖" },
  { username: "sam_debugs", display_name: "Sam", role: "student", avatar: "🐙" },
];

async function ensureUser(u) {
  const { data: existing } = await db.from("profiles").select("id").eq("username", u.username).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await db.auth.admin.createUser({ email: email(u.username), password, email_confirm: true });
  if (error) throw error;
  const { error: pErr } = await db.from("profiles").insert({ id: data.user.id, ...u });
  if (pErr) throw pErr;
  return data.user.id;
}

const QUESTIONS = [
  {
    type: "code_output",
    prompt: "What does this print?",
    code_snippet: "total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)",
    code_language: "python",
    choices: ["3", "4", "6", "10"],
    correct_index: 2,
    time_limit: 30,
  },
  {
    type: "multiple_choice",
    prompt: "Which of these creates a list in Python?",
    choices: ["(1, 2, 3)", "[1, 2, 3]", "{1, 2, 3}", "<1, 2, 3>"],
    correct_index: 1,
    time_limit: 20,
  },
  {
    type: "true_false",
    prompt: "range(5) includes the number 5.",
    choices: ["True", "False"],
    correct_index: 1,
    time_limit: 15,
  },
  {
    type: "code_output",
    prompt: "What does this print?",
    code_snippet: 'word = "code"\nprint(word[1] + word[-1])',
    code_language: "python",
    choices: ["ce", "oe", "co", "de"],
    correct_index: 1,
    time_limit: 30,
  },
  {
    type: "code_output",
    prompt: "How many times does this print \"hi\"?",
    code_snippet: 'count = 10\nwhile count > 4:\n    print("hi")\n    count -= 2',
    code_language: "python",
    choices: ["2", "3", "4", "5"],
    correct_index: 1,
    time_limit: 35,
  },
  {
    type: "multiple_choice",
    prompt: "What is a variable?",
    choices: ["A named place to store a value", "A type of loop", "An error message", "A Python keyword"],
    correct_index: 0,
    time_limit: 15,
  },
];

async function main() {
  const ids = {};
  for (const u of USERS) ids[u.username] = await ensureUser(u);
  console.log("✓ demo users");

  const teacher = ids.demo_teacher;
  let { data: quiz } = await db.from("quiz_sets").select("id").eq("owner_id", teacher).eq("title", "Python Basics Warm-Up").maybeSingle();
  if (!quiz) {
    ({ data: quiz } = await db
      .from("quiz_sets")
      .insert({
        owner_id: teacher,
        title: "Python Basics Warm-Up",
        description: "Loops, lists, strings and variables. A quick check for understanding.",
        topic: "Python fundamentals",
        grade_level: "Grades 6–8",
        is_public: true,
      })
      .select()
      .single());
    await db.from("questions").insert(QUESTIONS.map((q, position) => ({ ...q, position, points: 1000, quiz_set_id: quiz.id })));
  }
  console.log("✓ sample quiz");

  const { data: existingGame } = await db.from("games").select("id").eq("pin", "000001").maybeSingle();
  if (!existingGame) {
    const { data: questions } = await db.from("questions").select("*").eq("quiz_set_id", quiz.id).order("position");
    const { data: game } = await db
      .from("games")
      .insert({ pin: "000001", quiz_set_id: quiz.id, host_id: teacher, status: "finished", current_index: questions.length - 1, ended_at: new Date().toISOString() })
      .select()
      .single();

    // Scripted answers: [choice per question] for each student. Q5 (while loop) is the class's weak spot.
    const scripts = {
      maya_codes: [2, 1, 1, 1, 1, 0],
      leo_builds: [2, 1, 0, 3, 2, 0],
      sam_debugs: [0, 1, 1, 1, 3, 0],
      demo_student: [2, 0, 1, 1, 2, 0],
    };
    for (const [username, picks] of Object.entries(scripts)) {
      const user = USERS.find((u) => u.username === username);
      const { data: player } = await db
        .from("game_players")
        .insert({ game_id: game.id, user_id: ids[username], nickname: user.display_name, avatar: user.avatar })
        .select()
        .single();
      let score = 0;
      let streak = 0;
      const answers = picks.map((choice, i) => {
        const q = questions[i];
        const correct = choice === q.correct_index;
        const ms = 3000 + Math.floor(Math.random() * (q.time_limit * 600));
        const pts = correct ? Math.round(1000 * (1 - ms / (q.time_limit * 1000) / 2) * (1 + Math.min(streak, 5) * 0.1)) : 0;
        streak = correct ? streak + 1 : 0;
        score += pts;
        return { game_id: game.id, player_id: player.id, question_id: q.id, choice_index: choice, is_correct: correct, points_awarded: pts, response_ms: ms };
      });
      await db.from("answers").insert(answers);
      await db.from("game_players").update({ score, streak }).eq("id", player.id);
    }
    await db.rpc("award_game_points", { p_game_id: game.id });
    console.log("✓ sample finished game (PIN 000001, see /reports/000001)");
  }

  console.log(`\nDone! Log in as demo_admin / demo_teacher / demo_student with password "${password}".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
