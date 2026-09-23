import { redirect } from 'next/navigation'

// /dashboard/settings has no content of its own -- the sidebar links straight to
// /profile, but a bookmark or a hand-typed URL must not land on a 404.
export default function SettingsPage() {
    redirect('/dashboard/settings/profile')
}
