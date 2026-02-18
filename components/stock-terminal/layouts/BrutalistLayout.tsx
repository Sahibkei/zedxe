import { BaseTerminalLayout } from './shared';
import type { LayoutProps } from '../types';

export default function BrutalistLayout(props: LayoutProps) {
  return <BaseTerminalLayout {...props} variant='brutalist' />;
}
