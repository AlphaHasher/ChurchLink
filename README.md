<p align="center">
  <img src="https://github.com/user-attachments/assets/feb41274-e2a4-450a-af58-7164c9ecbfb3" width="75%">
</p>

## 📌 Overview

**ChurchLink** is a web and mobile platform designed to help churches manage their content, events, and community interactions. The project includes a **web builder** that allows church staff to create and update pages, add banners, post announcements, and engage with members through an easy-to-use interface.

So far, most of our work has been done on web and admin tools, but by the completion of CSC-191, a full suite for Admin-Web-Mobile will be completed.

## 🎯 Features

- **Simple Page Template System** – Create and edit church pages using pre-designed templates.
- **Headless CMS Integration** – Manage content dynamically without coding.
- **Event Management** – Create and promote church events.
- **User Roles & Permissions** – Secure access control for admins, editors, and members.
- **Mobile App Support** – Native mobile app built with Flutter.
- **Mobile Notifications** – Send push notifications for announcements, events, and updates.
- **Bible on Mobile** – Access and read the Bible within the app (future integration).
- **Announcements & Banners** – Display church updates and messages.
- **Donation & Payment Integration** – Support for online giving via **PayPal**.
- **Multilingual Support** – Accessibility for diverse church communities.



### 📋 Admin Interface, Users View
<p align="center">
  <img src="https://github.com/user-attachments/assets/1faf5c88-a333-4e5e-a399-6c59dc44630e" width="600" alt="Admin UI">
</p>

### 📋 Admin Interface, Creating a new Permission Role
<p align="center">
  <img src="https://github.com/user-attachments/assets/b5398827-a8da-42db-9fe7-cb64b2d797b9" width="600" alt="Role Creation">
</p>

### 📋 Admin Interface, Creating a new Event
<p align="center">
  <img src="https://github.com/user-attachments/assets/56fd6152-9e44-40a9-96b7-55227e41073f" width="600" alt="Event Creation">
</p>

### 🔨 Web Builder, Page View
<p align="center">
  <img src="https://github.com/user-attachments/assets/7e3bad19-1e61-4916-a851-25cb4a8dc0d6" width="600" alt="Web Builder">
</p>

### 🔨 Web Builder, Header Item Creation
<p align="center">
  <img src="https://github.com/user-attachments/assets/dc50bc84-b905-4eec-a60b-77c41b9d3468" width="600" alt="Header Creation">
</p>

### 🎥 Media Library, Strapi Integration
<p align="center">
  <img src="https://github.com/user-attachments/assets/b2b3b1fd-ef02-4ab1-a9de-4e696d775386" width="600" alt="Media Library">
</p>

### 👤 Login Popup
<p align="center">
  <img src="https://github.com/user-attachments/assets/a3194747-d719-467d-872d-babe77edbbae" width="600" alt="Login">
</p>

### 💻 Web Example
<p align="center">
  <img src="https://github.com/user-attachments/assets/204b81f6-7f41-4235-a692-2e4da7c36b3b" width="600" alt="Web Example">
</p>

### 📱 Mobile App – Event View
<p align="center">
  <img src="https://github.com/user-attachments/assets/cb5c3bb3-2b0b-4ab5-b5e3-2188d442e43b" width="300" alt="Mobile Event View">
</p>

## 🛠️ Tech Stack

- **Frontend:**  
  - **Flutter (Mobile App via the Dart Language)**  
  - **React (Web App via the TypeScript Language)**  

- **Backend: FaspAPI (Server via the Python Language)**

- **CMS:** Strapi

- **Database:**  
  - **MongoDB** (Main Database)  
  - **SQLite** (For CMS)  

- **Notifications:** Firebase Cloud Messaging (FCM)  

- **Bible Integration:** *(To be determined)*  

- **Authentication:** Firebase Auth  

- **Payments:** PayPal  

## 🚀 Installation

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16+)
- [Yarn](https://yarnpkg.com/) or npm
- [Flutter](https://flutter.dev/) (For mobile development)
- [Docker](https://www.docker.com/) (Optional for database setup)

### Steps (Just for DEMO README - NOT FINAL RELEASE)

1. **Clone the Repository**
   ```sh
   git clone https://github.com/YOUR_GITHUB/ChurchLink.git
   cd ChurchLink
   ```
   

2.	Install Dependencies
   ```sh
   yarn install
   ```
or

   ```sh
   npm install
   ```

3.	Set Up Environment Variables
Create a .env file in the root directory and add the necessary environment variables:
   ```sh
  DATABASE_URL=your_mongodb_url
  CMS_DATABASE_URL=your_sqlite_url
  FIREBASE_API_KEY=your_firebase_key
  PAYPAL_CLIENT_ID=your_paypal_client_id
   ```

4.	Run the Web Frontend (React)
  ```sh
  cd frontend/web
  yarn start
  ```

5.	Run the Mobile App (Flutter)
  ```sh
  cd frontend/app
  flutter run
  ```

6.	Run the CMS
  ```sh
  cd cms
  yarn develop
  ```

7.	Run the Backend (If applicable in the future)
  ```sh
  cd backend
  yarn dev
  ```

8.	Access the Application
	•	Web App: http://localhost:3000
	•	CMS Admin: http://localhost:1337/admin
	•	Mobile App: (Run on emulator or physical device)

## 🏗️ Project Structure

   ```sh
   ChurchLink/
   │── frontend/
   │   └── app/            # App frontend (Flutter)
   │   └── web/            # Web frontend (React)
   │── backend/            # Backend (To be determined)
   │── cms/                # Headless CMS (Strapi)
   │── docs/               # Documentation files
   │── .env                # Environment variables
   │── package.json        # Dependencies and scripts
   │── README.md           # Project documentation
   ```


## 🔔 Mobile Notifications

ChurchLink supports **push notifications** to keep church members informed about announcements, upcoming events, and other important updates.

- Uses **Firebase Cloud Messaging (FCM)** for push notifications.
- Admins can send notifications from the CMS.
- Users can **opt-in or opt-out** of notifications in their settings.

---

## 📖 Bible on Mobile *(Future Integration)*

ChurchLink will support an **integrated Bible feature** in the future, allowing users to:

- Read the **full Bible** within the app.
- Search for **specific verses and chapters**.
- View **daily scripture recommendations**.

---

## 💳 Donations & Payments

ChurchLink supports **online donations** through **PayPal**, allowing churches to accept **tithes and offerings** digitally.

- Integrated with **PayPal API** for secure transactions.
- Allows **one-time or recurring** donations.

---

## ⚙️ Permissions Currently Implemented

ChurchLink supports permissions implemented by the means of **user-defined permission roles.** Some of these permissions are directly integrated into **Strapi**, for a seamless transition from ChurchLink provided utilities to Strapi itself. Below is the list of permissions that can be implemented into these roles, that have fully been implemented as working.

- admin: Allows the user to have complete permissions access. Only able to be granted to default Administrator role. Allows for creation/edit/deletion of roles with permissions_management perm.

- permissions_management: Allows this user to be able to create/edit/delete/assign roles. Special rule: These users cannot edit roles with the admin or permissions management permissions. These users cannot change permissions they do not already explicitly have permissions for.

- event_editing: Allows this user to be able to create/edit/delete events. Special rule: This role becomes available now to be used in the "lock" model for Events, at least ONE of these Role Types is necessary to create events, these roles are the ONLY ones that can be assigned to events.

- event_management: Allows this user to be able to create/edit/delete ALL events regardless if they have the proper "keys" for the event "locks". event_management or admin is required in order to be able to edit the "locks" of pre-existing events. Reasoning why this is restricted to event managers is because if event editors could modify the locks, a massive headache would occur in multi-lock event systems when different users don't have ALL locks. Best to avoid them kicking eachother off, or editing roles they don't have access to.

- media_management: Allows this user to be able to upload/edit/delete media content in the Strapi Dashboard

---

## 📊 Database Design

Below is a comprehensive overview of the planned MongoDB Database integration

![image](https://github.com/user-attachments/assets/474516d7-ef95-47d1-8d20-be1606d4e074)

![image](https://github.com/user-attachments/assets/0a10a6a3-40bc-4f25-bfbf-75d85d0dae10)

![image](https://github.com/user-attachments/assets/4e92ee2d-73f0-4a3d-b8e0-2ac92203bca5)

![image](https://github.com/user-attachments/assets/d7ac3199-7b50-4327-be05-aff06136975d)


---

## ⏳ Predicted Timeline

Below is a tentative idea of the kind of timeline that we plan to see for CSC-191 in the completion of this project. Subject to change pending changing conditions of decision making.

Sprint 5 - Completion of Events, including the proper gathering of data for the user and EventPersons, Completing our PayPal Finances integration

Sprint 6 - The Completion of a fully functional Bible Reader, including Reading plans, completing notifications hubs

Sprint 7 - The Completion of Media-Watching such as with the Church's existing content, and watching YouTube livestreams. Completing integration of a simple viewer of pages for Mobile

Spint 8 - PROJECT SHOULD BE DONE, Clean-up of any remaining last things we want to get fixed or implemented

---

## 📖 Instructions

According to the guidelines for the README.md deliverable, sections must be laid out for testing, deployment, and developer instructions. While the filling out of this content is a CSC 191 assignment, we will section out these places. However, we would encourage a current reader of this repository to read our wiki for detailed instructions.

---

## 📖 Developer Instructions

---

## 📖 Testing Instructions

---

## 📖 Deployment Instructions

---

## 🤝 Contributing

We welcome contributions from the community! If you’d like to contribute:

1. **Fork** the repository and create a **new branch**.
2. **Make your changes** and ensure the project runs successfully.
3. **Submit a pull request** for review.

---

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.
