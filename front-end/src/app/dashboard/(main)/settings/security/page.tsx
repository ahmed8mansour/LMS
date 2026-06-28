import { Info, Eye, Monitor, Bell } from 'lucide-react'
import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'

import { UserChangePassword } from '@/featuers/auth'
import { PasswordManager } from '@/featuers/auth'


// TODO: replace with real API data
const mockSecurityData = {
  hasPassword: false,
  twoFactorEnabled: false
}

export default function SecuritySettingsPage() {
  return (
    <div className="col-span-12 md:col-span-9 space-y-6 md:space-y-8 w-full">
      {/* Set Password Section (Google Signup) || Change Password Section */}
      <PasswordManager />
    </div>
  )
}
