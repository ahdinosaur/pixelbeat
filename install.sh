#!/usr/bin/env bash

cd $(dirname $0)

if [[ -f pixelbeat.service ]]; then
	echo "Enabling Service..."
	systemctl enable $(pwd)/pixelbeat.service || exit -1

	echo "Starting Service..."
	systemctl start pixelbeat.service
	systemctl status pixelbeat.service
else
	echo "Could not find pixelbeat.service. Please run make first"
	exit -1
fi 
