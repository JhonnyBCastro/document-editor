#!/bin/bash
kill -9 $(lsof -t -i:8543) || true
cd /home/jhonny/TCC/document-editor/examples/vanilla-consumer
npm run preview > /dev/null 2>&1 &
SERVER_PID=$!
cd /home/jhonny/TCC/document-editor
while ! curl -s http://localhost:8543 > /dev/null; do sleep 1; done

echo "--- Running T60 ---"
node tests/e2e/t60-bug.spec.cjs

echo "--- Running UAT001 ---"
node tests/e2e/uat001-selection.spec.cjs

echo "--- Running UAT003 ---"
node tests/e2e/uat003-diagnostic.spec.cjs

echo "--- Running Merges ---"
node tests/e2e/test-merges.cjs

echo "--- Running PE-L ---"
node tests/e2e/pagination-stress.spec.cjs

echo "--- Running Audit Geometry ---"
node tests/e2e/audit-geometry.cjs

kill $SERVER_PID
