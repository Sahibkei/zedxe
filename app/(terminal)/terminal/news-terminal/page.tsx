import TerminalNewsWorkspace from '@/components/terminal/TerminalNewsWorkspace';
import { loadTerminalNewsItems } from '@/lib/news/terminal-items';

const TerminalNewsPage = async () => {
    const items = await loadTerminalNewsItems();
    return <TerminalNewsWorkspace items={items} />;
};

export default TerminalNewsPage;
