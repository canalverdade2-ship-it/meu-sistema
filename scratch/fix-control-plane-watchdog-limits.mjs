import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    sudo docker update --memory="1g" --memory-swap="1g" gsa-tv-control-plane
    sudo docker update --memory="1g" --memory-swap="1g" gsa-tv-watchdog

    for c in gsa-tv-control-plane gsa-tv-watchdog; do
      echo -n "$c: "
      sudo docker inspect --format 'CpusetCpus={{.HostConfig.CpusetCpus}} CpuShares={{.HostConfig.CpuShares}} Memory={{.HostConfig.Memory}} MemoryReservation={{.HostConfig.MemoryReservation}}' $c
    done
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
