run: mongo-start
	uv run main.py

mongo-run:
	docker run -d --name mongodb-ssbc -p 27017:27017 -v mongodb_data:/data/db mongo:latest

mongo-start:
	docker start mongodb-ssbc

mongo-stop:
	docker stop mongodb-ssbc && docker rm mongodb-ssbc

