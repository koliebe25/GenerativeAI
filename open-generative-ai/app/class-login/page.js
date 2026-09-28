import { redirect } from 'next/navigation';
import { getClassConfig, safeNextPath } from '@/lib/classAccess';
import ClassLoginForm from './ClassLoginForm';

export const metadata = {
  title: '수업 입장 — Open Generative AI',
};

export default async function ClassLoginPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNextPath(params?.next);

  // Nothing to unlock when the class gate is off.
  if (!getClassConfig().gateEnabled) redirect(next);

  return <ClassLoginForm next={next} />;
}
