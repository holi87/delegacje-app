import { useParams } from 'react-router-dom';

export default function DelegationDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1 className="text-2xl font-bold">Szczegoly delegacji</h1>
      <p className="mt-2 text-muted-foreground">
        Delegacja ID: {id} — widok w budowie.
      </p>
    </div>
  );
}
