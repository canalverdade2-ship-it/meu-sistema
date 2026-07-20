# Auth Gateway deployment

- Status: **success**
- Project: `ocgajvagxagutfvgxwsy`
- Source commit: `13735d8a8e3df7de048fe729f974bbf902a5744d`
- Run: https://github.com/canalverdade2-ship-it/meu-sistema/actions/runs/29768524477
- Allowed origins: `http://10.0.2.189:3000,http://localhost:3000,http://127.0.0.1:3000`

## link.log
```text
Finished supabase link.
```

## secrets.log
```text
[?25l[90m│[39m
[35m◒[39m  Setting secrets...
[1G[J[?25hFinished supabase secrets set.
```

## migration-apply.log
```text
```

## migration-repair.log
```text
Connecting to remote database...
Repaired migration history: [20260720193000] => applied
Finished [36msupabase migration repair[39m.
Run [36msupabase migration list[39m to show the updated migration history.
```

## migration-verify.log
```text
```

## function-deploy.log
```text
Bundling Function: gsa-auth-session
Unable to find image 'ghcr.io/supabase/edge-runtime:v1.74.2' locally
v1.74.2: Pulling from supabase/edge-runtime
b9136609bef0: Pulling fs layer
bfab333b5e81: Pulling fs layer
be4c37910e5f: Pulling fs layer
724041fce750: Pulling fs layer
abecb94bba46: Pulling fs layer
0367cb7f5023: Pulling fs layer
724041fce750: Waiting
abecb94bba46: Waiting
0367cb7f5023: Waiting
be4c37910e5f: Verifying Checksum
be4c37910e5f: Download complete
b9136609bef0: Verifying Checksum
b9136609bef0: Download complete
bfab333b5e81: Verifying Checksum
bfab333b5e81: Download complete
0367cb7f5023: Verifying Checksum
0367cb7f5023: Download complete
724041fce750: Verifying Checksum
724041fce750: Download complete
abecb94bba46: Verifying Checksum
abecb94bba46: Download complete
b9136609bef0: Pull complete
bfab333b5e81: Pull complete
be4c37910e5f: Pull complete
724041fce750: Pull complete
abecb94bba46: Pull complete
0367cb7f5023: Pull complete
Digest: sha256:a82676277615aee03c4f288cbbbf68dedb5ba8693073e567ab8dbfdd11ba5d45
Status: Downloaded newer image for ghcr.io/supabase/edge-runtime:v1.74.2
Deploying Function: gsa-auth-session (script size: 64 kB)
Deployed Functions on project ocgajvagxagutfvgxwsy: gsa-auth-session
You can inspect your deployment in the Dashboard: https://supabase.com/dashboard/project/ocgajvagxagutfvgxwsy/functions
```

## cors-verify.log
```text
http://10.0.2.189:3000 -> 204
http://localhost:3000 -> 204
http://127.0.0.1:3000 -> 204
https://blocked.example -> 403
```

