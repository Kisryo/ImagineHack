import { recommendLessons, completeLesson } from "@/lib/data";
import { revalidatePath } from "next/cache";

export default async function LearningPage() {
  const lessons = await recommendLessons();

  async function markDone(formData: FormData) {
    "use server";
    await completeLesson(String(formData.get("lesson_id")));
    revalidatePath("/learning");
    revalidatePath("/cpd");
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Learning loop</h1>
        <p className="text-sm opacity-70">
          Detected from your real client notes — not a generic course catalogue.
        </p>
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        {lessons.map((l) => (
          <article key={l.id} className="bg-white rounded-xl p-4 shadow-sm space-y-2">
            <div className="text-xs uppercase tracking-wide opacity-60">
              Triggered by: {l.trigger}
            </div>
            <h2 className="font-semibold">{l.title}</h2>
            <p className="text-sm opacity-80">{l.summary}</p>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs opacity-60">{l.cpdHours}h CPD</span>
              {l.completed ? (
                <span className="text-xs text-green-700 bg-green-100 rounded-full px-3 py-1">
                  ✓ Logged
                </span>
              ) : (
                <form action={markDone}>
                  <input type="hidden" name="lesson_id" value={l.id} />
                  <button className="bg-compass-accent text-white text-sm px-3 py-1.5 rounded-lg">
                    Mark complete
                  </button>
                </form>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
