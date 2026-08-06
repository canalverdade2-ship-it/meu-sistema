sudo docker inspect evolution-api --format '{{range .HostConfig.PortBindings}}{{printf "%q " .}}{{end}}'
sudo docker inspect evolution-api --format '{{range .HostConfig.NetworkMode}}{{printf "%q" .}}{{end}}'
