# REST API Documentation

This document describes the API endpoints, request schemas, and response payloads for the Pizza Customization E-Commerce platform.

---

## 🔑 Authentication

Most endpoints require a valid JSON Web Token (JWT) sent via cookies (`token`) or as a Bearer token in the `Authorization` header.

```
Authorization: Bearer <your_jwt_token>
```

---

## 👤 Auth Endpoints

### 1. Register User
- **Method**: `POST`
- **Path**: `/api/user/register`
- **Body Schema**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123"
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "60d01234567890abcdef1234",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    }
  }
  ```

### 2. Login User
- **Method**: `POST`
- **Path**: `/api/user/login`
- **Body Schema**:
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword123"
  }
  ```

---

## 🍕 Pizza Catalog Endpoints

### 1. Fetch All Pizzas
- **Method**: `GET`
- **Path**: `/api/pizzas`
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "60d01234567890abcdefabcd",
        "name": "Margherita",
        "basePrice": 199,
        "isAvailable": true
      }
    ]
  }
  ```

---

## 🛒 Cart Endpoints

### 1. Get User Cart
- **Method**: `GET`
- **Path**: `/api/cart`

### 2. Add To Cart
- **Method**: `POST`
- **Path**: `/api/cart/add`
- **Body Schema**:
  ```json
  {
    "pizzaId": "60d01234567890abcdefabcd",
    "name": "Margherita",
    "size": { "name": "Medium", "price": 50 },
    "crust": { "name": "Thin", "price": 0 },
    "toppings": ["olives", "mushrooms"],
    "qty": 2
  }
  ```

---

## 📦 Order Endpoints

### 1. Create Order
- **Method**: `POST`
- **Path**: `/api/orders`
- **Body Schema**:
  ```json
  {
    "address": "123 Main Street, New Delhi, 110001",
    "phone": "9876543210",
    "paymentMethod": "cod"
  }
  ```

### 2. Get My Orders
- **Method**: `GET`
- **Path**: `/api/orders/my-orders`
