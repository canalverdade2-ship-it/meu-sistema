const dns = require('dns').promises;

function ipv6ToBigInt(value) {
  const [head, tail] = value.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = 8 - left.length - right.length;
  const groups = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right];
  return groups.reduce((result, group) => (result << 16n) + BigInt(`0x${group || '0'}`), 0n);
}

function isInPrefix(address, cidr) {
  const [network, lengthText] = cidr.split('/');
  const length = BigInt(lengthText);
  const shift = 128n - length;
  return (ipv6ToBigInt(address) >> shift) === (ipv6ToBigInt(network) >> shift);
}

async function main() {
  const records = await dns.resolve6('db.ocgajvagxagutfvgxwsy.supabase.co');
  const response = await fetch('https://ip-ranges.amazonaws.com/ip-ranges.json');
  if (!response.ok) throw new Error(`AWS IP ranges request failed: ${response.status}`);
  const ranges = await response.json();

  for (const address of records) {
    const matches = ranges.ipv6_prefixes.filter((entry) => isInPrefix(address, entry.ipv6_prefix));
    console.log(JSON.stringify({ address, matches }, null, 2));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
