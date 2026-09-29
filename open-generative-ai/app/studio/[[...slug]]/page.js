import StandaloneShell from '@/components/StandaloneShell';
import { getShellClassProps } from '@/lib/classAccess';

export const metadata = {
  title: 'Studio — Open Generative AI',
};

export default function StudioPage() {
  return <StandaloneShell {...getShellClassProps()} />;
}
