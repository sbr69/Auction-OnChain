import { STROOPS_PER_XLM } from './constants';

export function stroopsToXlm(stroops: bigint | number | string): number {
  const num = typeof stroops === 'bigint' ? Number(stroops) : Number(stroops);
  return num / STROOPS_PER_XLM;
}

export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * STROOPS_PER_XLM));
}

export function formatXlm(xlm: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
  }).format(xlm) + ' XLM';
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
}

export function formatTimeRemaining(endTimeSeconds: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
} {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTimeSeconds - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const days = Math.floor(diff / (3600 * 24));
  const hours = Math.floor((diff % (3600 * 24)) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  return { days, hours, minutes, seconds, isExpired: false };
}

export function resolveIpfsUrl(url: string): string {
  if (!url) return 'https://placehold.co/600x400/121420/8b5cf6?text=No+Media';
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return url;
}
