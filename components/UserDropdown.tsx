'use client';

import { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {LogOut, User as UserIcon} from "lucide-react";
import NavItems from "@/components/NavItems";
import {signOut} from "@/lib/actions/auth.actions";
import ProfileModal from "@/components/profile/ProfileModal";

const UserDropdown = ({ user, initialStocks }: {user: User, initialStocks: StockWithWatchlistStatus[]}) => {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const userInitial = user.name?.[0]?.toUpperCase() ?? "?";

    const handleSignOut = async () => {
        await signOut();
        router.push("/sign-in");
    }

    const handleOpenProfile = () => {
        setProfileOpen(true);
        setMenuOpen(false);
    }

    return (
        <>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-3 text-slate-200 hover:text-[#58a6ff]">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user.image || undefined} />
                            <AvatarFallback className="bg-[#58a6ff] text-[#010409] text-sm font-bold">
                                {userInitial}
                            </AvatarFallback>
                        </Avatar>
                        <div className="hidden md:flex flex-col items-start">
                            <span className='text-base font-medium text-slate-200'>
                                {user.name}
                            </span>
                        </div>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="border-[#1c2432] bg-[#0d1117] text-slate-200">
                    <DropdownMenuLabel>
                        <div className="flex relative items-center gap-3 py-2">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={user.image || undefined} />
                                <AvatarFallback className="bg-[#58a6ff] text-[#010409] text-sm font-bold">
                                    {userInitial}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className='text-base font-medium text-slate-200'>
                                    {user.name}
                                </span>
                                <span className="text-sm text-slate-400">{user.email}</span>
                            </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[#1c2432]"/>
                    <DropdownMenuItem onClick={handleOpenProfile} className="cursor-pointer text-md font-medium text-slate-100 transition-colors focus:bg-transparent focus:text-[#58a6ff]">
                        <UserIcon className="h-4 w-4 mr-2 hidden sm:block" />
                        Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-md font-medium text-slate-100 transition-colors focus:bg-transparent focus:text-[#58a6ff]">
                        <LogOut className="h-4 w-4 mr-2 hidden sm:block" />
                        Logout
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="hidden sm:block bg-[#1c2432]"/>
                    <nav className="sm:hidden">
                        <NavItems initialStocks={initialStocks} />
                    </nav>
                </DropdownMenuContent>
            </DropdownMenu>

            <ProfileModal user={user} open={profileOpen} onOpenChange={setProfileOpen} />
        </>
    )
}
export default UserDropdown
