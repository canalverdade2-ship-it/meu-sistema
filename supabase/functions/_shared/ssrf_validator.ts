export function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    if (url.username || url.password) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost and standard private ranges
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      hostname === '::1'
    ) {
      return false;
    }

    // Block 172.16.x.x - 172.31.x.x
    const parts = hostname.split('.');
    if (parts.length === 4 && parts[0] === '172') {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return false;
      }
    }

    // AWS / GCP Metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}
