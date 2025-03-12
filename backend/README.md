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
