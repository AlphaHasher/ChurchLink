run: mongo-start
	uv run main.py

mongo-run:
	docker run -d --name mongodb-ssbc -p 27017:27017 -v mongodb_data:/data/db mongo:latest

mongo-start:
	docker start mongodb-ssbc

mongo-stop:
	docker stop mongodb-ssbc && docker rm mongodb-ssbc

mongo-drop:
	@read -p "Confirm database drop (type 'yes'): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		uv run python3 -c "\
import os, pymongo; \
from dotenv import load_dotenv; \
load_dotenv(); \
client = pymongo.MongoClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017')); \
db_name = os.getenv('DB_NAME', 'SSBC_DB'); \
client.drop_database(db_name); \
print(f'Database {db_name} dropped')"; \
	fi

mongo-drop-force:
	uv run python3 -c "\
import os, pymongo; \
from dotenv import load_dotenv; \
load_dotenv(); \
client = pymongo.MongoClient(os.getenv('MONGODB_URL', 'mongodb://localhost:27017')); \
db_name = os.getenv('DB_NAME', 'SSBC_DB'); \
client.drop_database(db_name); \
print(f'Database {db_name} dropped')"

