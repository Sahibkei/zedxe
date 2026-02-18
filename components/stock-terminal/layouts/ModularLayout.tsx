import { BaseTerminalLayout } from './shared';
import type { LayoutProps } from '../types';

export default function ModularLayout(props: LayoutProps) {
  return <BaseTerminalLayout {...props} variant='modular' />;
}
