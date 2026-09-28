import StandaloneShell from '@/components/StandaloneShell';
import { getClassConfig } from '@/lib/classAccess';

export const metadata = {
  title: '스튜디오 — Open Generative AI',
};

// Korean locale route wrapper (same pattern as app/zh/studio/[[...slug]]/page.js).
export default function KoStudioPage() {
  return <StandaloneShell locale="ko" managedKey={getClassConfig().managedKey} />;
}
