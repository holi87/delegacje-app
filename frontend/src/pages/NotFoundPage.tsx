import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="text-center max-w-lg">
        <h1 className="text-6xl font-bold text-muted-foreground mb-2">404</h1>
        <h2 className="text-xl font-semibold mb-2">Strona nie znaleziona</h2>
        <p className="text-muted-foreground mb-6">
          Strona, której szukasz, nie istnieje lub została przeniesiona.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Wróć na stronę główną
        </Link>
      </div>
    </div>
  );
}
