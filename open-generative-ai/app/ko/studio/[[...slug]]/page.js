import StandaloneShell from '@/components/StandaloneShell';
import { getShellClassProps } from '@/lib/classAccess';

export const metadata = {
  title: '스튜디오 — Open Generative AI',
};

// Korean locale route wrapper (same pattern as app/zh/studio/[[...slug]]/page.js).
export default function KoStudioPage() {
  return <StandaloneShell locale="ko" {...getShellClassProps()} />;
}
