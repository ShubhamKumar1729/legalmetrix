import { redirect } from 'next/navigation';

/** The application opens straight into the workspace; unauthenticated visitors are sent to sign in. */
export default function RootPage() {
  redirect('/app/dashboard');
}
