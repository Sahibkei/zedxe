import { BaseTerminalLayout } from './shared';
import type { LayoutProps } from '../types';

export default function UtilitarianLayout(props: LayoutProps) {
  return <BaseTerminalLayout {...props} variant='utilitarian' />;
}
