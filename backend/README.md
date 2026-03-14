# Python FastAPI Starter

This is a starter project for a Python FastAPI application.

## Features

- GET endpoint
- POST endpoint
- CORS middleware configured to allow all origins

## Getting Started

### Prerequisites

- Python 3.8+
- pip

### Installation

1. **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2. **Create a virtual environment:**

    ```bash
    python3 -m venv venv
    ```

3. **Activate the virtual environment:**

    - **On macOS and Linux:**

        ```bash
        source venv/bin/activate
        ```

    - **On Windows:**

        ```bash
        venv\Scripts\activate
        ```

4. **Install the dependencies:**

    ```bash
    pip3 install -r requirements.txt
    ```

### Running the Application

To run the application, use the following command:

```bash
uvicorn src.main:app --reload
```

The application will be available at `http://127.0.0.1:8000`.

## API Endpoints

### GET /

- **Description:** A simple endpoint that returns a "Hello World" message.
- **Response:**

    ```json
    {
      "Hello": "World"
    }
    ```

### POST /items/

- **Description:** Creates a new item.
- **Request Body:**

    ```json
    {
      "name": "string",
      "description": "string",
      "price": "float",
      "tax": "float"
    }
    ```

- **Response:** The created item.

    ```json
    {
      "name": "string",
      "description": "string",
      "price": "float",
      "tax": "float"
    }
    ```
