const actions = [
  {
    emoji: "🥖",
    title: "Pane",
  },
  {
    emoji: "🥐",
    title: "Brioche",
  },
  {
    emoji: "🍕",
    title: "Pizza",
  },
  {
    emoji: "📖",
    title: "Ricette",
  },
];

export default function QuickActions() {
  return (
    <div className="mt-12 flex flex-wrap justify-center gap-4">
      {actions.map((action) => (
        <button
          key={action.title}
          className="rounded-xl bg-white px-5 py-3 shadow transition hover:shadow-lg"
        >
          {action.emoji} {action.title}
        </button>
      ))}
    </div>
  );
}