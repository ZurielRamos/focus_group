import { Suspense } from "react";
import { PlayerView } from "../../PlayerView";

// Con cacheComponents, leer `params` es acceso dinámico y debe ir dentro de <Suspense>.
async function Content({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayerView code={code.toUpperCase()} />;
}

export default function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="p-6 text-[#8a5a3c]">Cargando…</div>}>
      <Content params={params} />
    </Suspense>
  );
}
