# FastAPI Project with Scalar Docs

This project is a simple FastAPI application using **[Scalar](https://scalar-api.com/)** for beautiful API documentation and **[uv](https://github.com/astral-sh/uv)** for easy dependency management.

## 🚀 Getting Started

### 1. Install `uv`
The fastest way to set up this project is by using **`uv`**, a fast Python package manager that also handles Python version management.

Install `uv`:

See the official [repo for installation guide](https://github.com/astral-sh/uv).

---

### 2. Run the Application
Simply run:

```bash
uv run main.py
```

- server might run on 0.0.0.0:8000, force host run on 127.0.0.1 to debug correctly

```bash
uv run python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

This will:
- Automatically install the correct Python version (as defined in `.python-version`).
- Install dependencies from `pyproject.toml`.
- Run your FastAPI app on **http://localhost:8000**.

---

## 📜 Scalar API Docs
This project uses **[Scalar](https://scalar-api.com/)** to generate beautiful API documentation.

- Access your API normally at:  
  **[http://localhost:8000/docs](http://localhost:8000/docs)**

- Access the Scalar documentation at:  
  **[http://localhost:8000/scalar](http://localhost:8000/scalar)**

Scalar offers:
- Clean, modern API reference.
- Dark mode by default.


---

## ✅ Notes
- You **do not** need to manually create a virtual environment; `uv` does it automatically.
- `uv` ensures you're always using the correct Python version defined in `.python-version`.
- To install any new package, simply run:
```bash
uv add <package-name>
```

---

## 🔑 Managing Roles
This project includes an `add_roles.py` script to help manage user roles in Firebase Authentication.

### Using add_roles.py
To modify user roles, run:
```bash
uv run add_roles.py <user-id> <role1> [role2 ...]
```

For example:
```bash
# Add roles
uv run add_roles.py user123 base admin finance

# Remove roles using --remove flag
uv run add_roles.py user123 admin --remove
```

The script will:
- Connect to Firebase Authentication
- Modify the user's custom claims to add or remove roles
- Display the updated roles for the user

Available options:
- `<user-id>`: The Firebase user ID to modify
- `<role1> [role2 ...]`: One or more roles to add/remove
- `--remove`: Optional flag to remove roles instead of adding them

The script will show success/error messages and display the user's current roles after modification.

## 🗄️ Database Setup
This project uses MongoDB as its database. The easiest way to run MongoDB is using Docker:

```bash
docker run -d --name mongodb -p 27017:27017 mongo:latest
```

This command:
- Runs MongoDB in detached mode (in background)
- Names the container "mongodb"
- Maps port 27017 to your local machine
- Uses the latest MongoDB image

Useful Docker commands:
```bash
# Check if container is running
docker ps

# Stop the container
docker stop mongodb

# Remove the container
docker rm mongodb
```

The application will automatically connect to MongoDB at `mongodb://localhost:27017`.

## 🔥 Firebase Setup
Before running the application, you need to set up Firebase credentials:

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Generate a service account key:
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the downloaded JSON file
3. Place the JSON file in the `firebase` directory
4. Rename the file to `firebase_credentials.json`

Your directory structure should look like:
