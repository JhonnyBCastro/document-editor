kill -9 $(lsof -t -i:8543) || true
cd /home/jhonny/TCC/document-editor/examples/vanilla-consumer
npm run preview > /dev/null 2>&1 &
SERVER_PID=$!
cd /home/jhonny/TCC/document-editor
while ! curl -s http://localhost:8543 > /dev/null; do sleep 1; done
node tests/e2e/obs-t1.cjs
kill $SERVER_PID
