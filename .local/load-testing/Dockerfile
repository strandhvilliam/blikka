FROM grafana/k6:0.49.0

WORKDIR /work

COPY k6 ./k6
COPY fixtures ./fixtures

ENTRYPOINT ["k6", "run", "/work/k6/by-camera-upload.js"]
