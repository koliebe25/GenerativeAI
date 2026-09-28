import StandaloneShell from '@/components/StandaloneShell';
import { getClassConfig } from '@/lib/classAccess';

export const metadata = {
  title: 'Studio — Open Generative AI',
};

export default function StudioPage() {
  return <StandaloneShell managedKey={getClassConfig().managedKey} />;
}
