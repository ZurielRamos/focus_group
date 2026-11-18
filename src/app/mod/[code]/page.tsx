import { Suspense } from "react";
import { ModeratorView } from "../ModeratorView";

// Con cacheComponents, leer `params` es acceso dinámico y debe ir dentro de <Suspense>.
async function Content({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ModeratorView code={code.toUpperCase()} />;
}

export default function ModeratorPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="p-6 text-[#8a5a3c]">Cargando…</div>}>
      <Content params={params} />
    </Suspense>
  );
}
