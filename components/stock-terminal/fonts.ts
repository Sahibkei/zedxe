import { DM_Mono, DM_Sans, Barlow_Condensed, Syne, IBM_Plex_Mono, Nunito, Playfair_Display, Orbitron, Share_Tech_Mono, Bebas_Neue } from 'next/font/google';

const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono' });
const bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: ['400'], variable: '--font-bebas-neue' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-barlow-condensed' });
const syne = Syne({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-syne' });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-dm-sans' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ibm-plex-mono' });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-nunito' });
const playfairDisplay = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-playfair-display' });
const orbitron = Orbitron({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-orbitron' });
const shareTechMono = Share_Tech_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-share-tech-mono' });

export const terminalFontsClassName = [
  dmMono.variable,
  bebasNeue.variable,
  barlowCondensed.variable,
  syne.variable,
  dmSans.variable,
  ibmPlexMono.variable,
  nunito.variable,
  playfairDisplay.variable,
  orbitron.variable,
  shareTechMono.variable,
].join(' ');
