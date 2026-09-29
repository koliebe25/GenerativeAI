import { redirect } from 'next/navigation';

// Korean is the default UI for this class deployment; English stays at /studio.
export default function Home() {
  redirect('/ko/studio');
}
