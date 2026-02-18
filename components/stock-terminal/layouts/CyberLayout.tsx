import { BaseTerminalLayout } from './shared';
import type { LayoutProps } from '../types';

export default function CyberLayout(props: LayoutProps) {
  return <BaseTerminalLayout {...props} variant='cyber' />;
}
