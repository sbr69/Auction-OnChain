/**
 * IPFS upload service via Pinata.
 * Uses VITE_PINATA_JWT from .env for authentication.
 */

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string;
const PINATA_GATEWAY = (import.meta.env.VITE_PINATA_GATEWAY as string) || 'https://gateway.pinata.cloud';

export interface IpfsUploadResult {
  cid: string;
  ipfsUrl: string;
  gatewayUrl: string;
}

/**
 * Upload a file to IPFS via Pinata's pinning service.
 * Returns the canonical ipfs:// URL and a resolved gateway URL.
 */
export async function uploadImageToIPFS(file: File): Promise<IpfsUploadResult> {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT is not configured. Add VITE_PINATA_JWT to your .env file.');
  }

  const formData = new FormData();
  formData.append('file', file);

  // Set metadata for the pin
  const metadata = JSON.stringify({
    name: `stellarbid-auction-${Date.now()}-${file.name}`,
    keyvalues: {
      app: 'stellarbid',
      timestamp: String(Date.now()),
    },
  });
  formData.append('pinataMetadata', metadata);

  const options = JSON.stringify({ cidVersion: 1 });
  formData.append('pinataOptions', options);

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const cid = data.IpfsHash as string;

  return {
    cid,
    ipfsUrl: `ipfs://${cid}`,
    gatewayUrl: `${PINATA_GATEWAY}/ipfs/${cid}`,
  };
}

/**
 * Resolves an ipfs:// URL to a publicly accessible HTTP gateway URL.
 */
export function resolveIpfsGatewayUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '');
    return `${PINATA_GATEWAY}/ipfs/${cid}`;
  }
  return url;
}
