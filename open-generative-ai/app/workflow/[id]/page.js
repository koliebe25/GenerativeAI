import StandaloneShell from '@/components/StandaloneShell';
import { getClassConfig } from '@/lib/classAccess';

export const metadata = {
  title: 'Workflow — Open Generative AI',
};

export default function WorkflowPage() {
  return <StandaloneShell managedKey={getClassConfig().managedKey} />;
}
