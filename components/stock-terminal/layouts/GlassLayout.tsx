import { BaseTerminalLayout } from './shared';
import type { LayoutProps } from '../types';

export default function GlassLayout(props: LayoutProps) {
  return <BaseTerminalLayout {...props} variant='glass' />;
}
