import { redirect } from 'next/navigation';

/** Settings merged into Profile — see `sdd/exams.md`. Redirect rather than delete: this was a real nav destination, might be bookmarked. */
export default function SettingsPage() {
  redirect('/dashboard/profile');
}
