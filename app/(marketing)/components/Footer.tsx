import Link from "next/link";

const Footer = () => {
    return (
        <footer className="border-t border-white/10 py-10">
            <div className="container flex flex-col items-center justify-between gap-6 text-sm text-gray-400 md:flex-row">
                <span className="tracking-[0.3em] text-white">ZEDXE</span>
                <div className="flex gap-6">
                    <Link href="/" className="transition hover:text-white">
                        Home
                    </Link>
                    <Link href="/api" className="transition hover:text-white">
                        API
                    </Link>
                    <Link href="/api/docs" className="transition hover:text-white">
                        Docs
                    </Link>
                </div>
                <span>&copy; {new Date().getFullYear()} ZedXe. All rights reserved.</span>
            </div>
        </footer>
    );
};

export default Footer;
