import StandaloneShell from '@/components/StandaloneShell';
import { getShellClassProps } from '@/lib/classAccess';

export const metadata = {
  title: 'Workflow — Open Generative AI',
};

export default function WorkflowTabPage() {
  return <StandaloneShell {...getShellClassProps()} />;
}
