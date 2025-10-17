run:
	uv run main.py

run_mongo:
	docker run -d --name mongo-container -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo

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
