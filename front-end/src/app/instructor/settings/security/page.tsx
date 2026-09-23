import { PasswordManager } from '@/featuers/auth'

export default function SecuritySettingsPage() {
  return (
    <div className="flex-1 space-y-6 md:space-y-8 w-full">
      {/* Renders "Set Password" for Google-signup accounts and "Change Password"
          for accounts that already have a usable one. */}
      <PasswordManager />
    </div>
  )
}
