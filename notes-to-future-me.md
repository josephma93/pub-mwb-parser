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