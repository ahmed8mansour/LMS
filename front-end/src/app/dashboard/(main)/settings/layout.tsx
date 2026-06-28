'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { GoPerson } from "react-icons/go";
import { MdOutlineSecurity } from "react-icons/md";
import { MdOutlinePayments } from "react-icons/md";
import { FaChevronRight } from "react-icons/fa";


export default function settings({children}: {children: React.ReactNode}) {
    const pathname = usePathname()

    return (
        <main className="bg-lightbg min-h-screen p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                <div className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-headline font-extrabold text-darktext tracking-tight">Settings</h2>
                <p className="text-graytext2 mt-1 text-sm md:text-base">Manage your account preferences and profile information.</p>
                </div>
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                <aside className="w-full lg:w-64 lg:shrink-0">
                <nav className="flex flex-col gap-1">
                <Link className={`flex items-center justify-between px-4 py-3 ${pathname === '/dashboard/settings' || pathname === '/dashboard/settings/profile' ? 'bg-darkmint/10 text-darktext/80 font-bold' : 'text-darktext/60'} rounded-lg group`} href="/dashboard/settings/profile">
                <span className="flex items-center gap-3">
                <GoPerson size={20} />
                                                Profile
                                            </span>
                                            <FaChevronRight className="text-sm opacity-0 group-hover:opacity-100 transition-opacity" />

                </Link>
                <Link className={`flex items-center justify-between px-4 py-3 ${pathname === '/dashboard/settings/security' ? 'bg-darkmint/10 text-darktext/80 font-bold' : 'text-darktext/60'} rounded-lg transition-colors group`} href="/dashboard/settings/security">
                <span className="flex items-center gap-3">
                <MdOutlineSecurity size={20} />
                                                Security
                                            </span>
                <FaChevronRight className="text-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                <Link className={`flex items-center justify-between px-4 py-3 ${pathname === '/dashboard/settings/billing' ? 'bg-darkmint/10 text-darktext/80 font-bold' : 'text-darktext/60'} rounded-lg transition-colors group`} href="/dashboard/settings/billing">
                <span className="flex items-center gap-3">
                <MdOutlinePayments size={20} />
                                                Billing
                                            </span>
                <FaChevronRight className="text-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                </nav>
                </aside>

                {children}
                </div>
                </div>
        </main>
    )
}
