'use client'

import {NAV_ITEMS} from "@/lib/constants";
import Link from "next/link";
import {usePathname} from "next/navigation";
import SearchCommand from "@/components/SearchCommand";

const NavItems = ({initialStocks}: { initialStocks: StockWithWatchlistStatus[]}) => {
    const pathname = usePathname()

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/';
        if (path === '/app') return pathname === '/app';

        return pathname === path || pathname.startsWith(`${path}/`);
    }

    const navItemClass = (active: boolean) =>
        `inline-flex w-full items-center justify-center rounded-xl border px-4 py-2 text-[0.95rem] font-medium transition-all duration-200 lg:w-auto ${
            active
                ? 'border-[#314763] bg-gradient-to-b from-[#171f2d] to-[#0f1622] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_18px_rgba(0,0,0,0.35)]'
                : 'border-transparent text-slate-300 hover:border-[#233245] hover:bg-[#101826] hover:text-slate-100'
        }`;

    return (
        <ul className="flex flex-col gap-2 text-sm lg:flex-row lg:items-center lg:gap-1">
            {NAV_ITEMS.map(({ href, label }) => {
                const active = isActive(href);

                if(href === '/search') return (
                    <li key="search-trigger">
                        <SearchCommand
                            renderAs="text"
                            label="Search"
                            textClassName={navItemClass(active)}
                            initialStocks={initialStocks}
                        />
                    </li>
                )

                return <li key={href}>
                    <Link href={href} className={navItemClass(active)}>
                        {label}
                    </Link>
                </li>
            })}
        </ul>
    )
}
export default NavItems
