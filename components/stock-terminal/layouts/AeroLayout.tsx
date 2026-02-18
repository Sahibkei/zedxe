import { BaseTerminalLayout } from './shared';
import type { LayoutProps } from '../types';

export default function AeroLayout(props: LayoutProps) {
  return <BaseTerminalLayout {...props} variant='aero' />;
}
