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
