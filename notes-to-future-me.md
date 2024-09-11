Test scrappers with `curl`.
```bash
curl -s -X GET http://localhost:3389/source-html/meeting-html | curl -X POST http://localhost:3389/scrappers/week-date-span -H "Content-Type: application/json" -d @-
```
Make it look nicer:
```bash
curl -s -X GET http://localhost:3389/source-html/meeting-html | curl -X POST http://localhost:3389/scrappers/week-date-span -H "Content-Type: application/json" -d @- | jq
```

Nice and quiet:
```bash
curl -s -X GET http://localhost:3389/source-html/meeting-html | curl -s -X POST http://localhost:3389/scrappers/week-date-span -H "Content-Type: application/json" -d @- | jq
```

Test image locally
```bash
PACKAGE_NAME=$(jq -r '.name' package.json)
docker build -t ${PACKAGE_NAME} -t ${PACKAGE_NAME} .
docker run --rm -it ${PACKAGE_NAME}
docker run -it --rm --name pub-mwb-parser \
  -e PMP_PORT=3000 \
  -p 3000:3000 \
  ${PACKAGE_NAME}
```