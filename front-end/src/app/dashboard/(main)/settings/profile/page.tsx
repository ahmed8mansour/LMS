import { Info } from 'lucide-react'
import { ProfileForm } from '@/featuers/progress'



export default function ProfilePage() {
  return (
    <div className="flex-1 bg-muted rounded-xl p-4 md:p-8 border border-border/30 shadow-sm">
      <div className="mb-6 md:mb-8 p-3 md:p-4 bg-darkmint/10 border-l-4 border-primary rounded-r-lg">
        <div className="flex gap-3">
          <Info className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are redirected here after registration to complete your profile. Providing accurate information helps us personalize your learning experience.
          </p>
        </div>
      </div>
      <ProfileForm/>
    </div>
  )
}
