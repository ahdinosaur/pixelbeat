pixelbeat.service: pixelbeat.service.in
	sed 's%PIXELBEAT_PATH%'`pwd`'%' pixelbeat.service.in > pixelbeat.service
