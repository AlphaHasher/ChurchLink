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

1. Go to the Firebase project Tai made at [Link to Project](https://console.firebase.google.com/project/ssbc-9ef2d/settings/general/web:NDkxODllZGItM2ZhMC00YTE2LWIwOTQtNGJiZTM0MzNjMzk2)
2. Generate a service account key:
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the downloaded JSON file
3. Place the JSON file in the `firebase` directory
4. Rename the file to `firebase_credentials.json`

# 🛣️ Adding New Routes

This project uses a role-based routing structure with corresponding model files. For a complete working example, refer to:
- `models/item.py` - Example model with CRUD operations
- `routes/base_routes/item_routes.py` - Example route implementation with all standard REST endpoints

### 1. Create a Model
First, create a model file in the `models` directory, following the pattern in `models/item.py`:

```python
# models/your_model.py
from typing import Optional
from pydantic import BaseModel
from helpers.DB import DB
from bson import ObjectId

class YourModelBase(BaseModel):
    name: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True

class YourModelCreate(YourModelBase):
    pass

class YourModelOut(YourModelBase):
    id: str

# Add CRUD Operations (see models/item.py for a complete example)
async def create_your_model(item: YourModelCreate):
    result = await DB.db["your_collection"].insert_one(item.model_dump())
    item_data = await DB.db["your_collection"].find_one({"_id": result.inserted_id})
    return YourModelOut(id=str(item_data["_id"]), **item_data)

async def get_your_model(id: str):
    # ... implementation ...
```

### 2. Create a Route File
Add your route file in the appropriate role-based directory (see `routes/base_routes/item_routes.py` for a complete example):

```python
# routes/[role]_routes/your_model_routes.py
from fastapi import APIRouter
from models.your_model import YourModelCreate, create_your_model

your_model_router = APIRouter(prefix="/your-models")

@your_model_router.get("/")
async def get_items_route():
    # ... implementation ...

@your_model_router.post("/")
async def create_item_route(item: YourModelCreate):
    return await create_your_model(item)
```

### 3. Include the Router
In `main.py`, import and include your router in the appropriate section:

```python
from routes.base_routes.your_model_routes import your_model_router as your_model_router_base

# For base routes
router_base.include_router(your_model_router_base)

# For admin routes
router_admin.include_router(your_model_router_admin)

# For finance routes
router_finance.include_router(your_model_router_finance)
```

### Route Structure
- Base routes (`/api/v1/*`): General features for authenticated users
- Admin routes (`/api/v1/admin/*`): Administrative features
- Finance routes (`/api/v1/finance/*`): Finance-related features
- Dev routes (`/api/v1/dev/*`): Development utilities

### Common REST Endpoints
Include these standard endpoints in your route files:
```python
@router.get("/")              # List all items
@router.get("/{id}")          # Get single item
@router.post("/")             # Create item
@router.patch("/{id}")        # Update item
@router.delete("/{id}")       # Delete item
```

### Access Control
Routes are automatically protected based on their location:
- `base_routes`: Requires "base" role
- `admin_routes`: Requires "admin" role
- `finance_routes`: Requires "finance" role
- `dev_routes`: Requires "developer" role

## 🔐 API Authentication
All API requests must include a Firebase ID token in the Authorization header. The token should be included as a Bearer token.

### Web Example (Fetch API)
```javascript
// Get the token from Firebase Auth
const token = await firebase.auth().currentUser.getIdToken();

// Make API request
const response = await fetch('http://localhost:8000/api/v1/items', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  // other fetch options...
});

// Example with full CRUD operations
const api = {
  // GET request
  async getItems() {
    const token = await firebase.auth().currentUser.getIdToken();
    const response = await fetch('http://localhost:8000/api/v1/items', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.json();
  },

  // POST request
  async createItem(data) {
    const token = await firebase.auth().currentUser.getIdToken();
    const response = await fetch('http://localhost:8000/api/v1/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};
```

### Flutter Example (Dio)
```dart
import 'package:dio/dio.dart';

class ApiService {
  final Dio _dio = Dio();
  
  // Initialize with base URL
  ApiService() {
    _dio.options.baseUrl = 'http://localhost:8000/api/v1';
  }

  // Add auth token to requests
  Future<void> setAuthToken(String token) {
    _dio.options.headers['Authorization'] = 'Bearer $token';
  }

  // Example CRUD operations
  Future<List<Item>> getItems() async {
    final response = await _dio.get('/items');
    return (response.data as List)
        .map((item) => Item.fromJson(item))
        .toList();
  }

  Future<Item> createItem(Map<String, dynamic> data) async {
    final response = await _dio.post('/items', 
      data: data,
    );
    return Item.fromJson(response.data);
  }

  Future<Item> updateItem(String id, Map<String, dynamic> data) async {
    final response = await _dio.patch('/items/$id', 
      data: data,
    );
    return Item.fromJson(response.data);
  }

  Future<void> deleteItem(String id) async {
    await _dio.delete('/items/$id');
  }
}

// Usage example
void main() async {
  final api = ApiService();
  
  // Get token from Firebase
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();
  await api.setAuthToken(token!);

  // Make authenticated requests
  final items = await api.getItems();
}
```

Remember to:
1. Get a fresh token before making requests
2. Handle token expiration and refresh
3. Include the token in all API requests
4. Handle authentication errors (401, 403)
