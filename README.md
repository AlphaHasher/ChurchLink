<p align="center">
  <img src="https://github.com/user-attachments/assets/feb41274-e2a4-450a-af58-7164c9ecbfb3" width="75%">
</p>

## 📌 Overview

**ChurchLink** is a web and mobile platform designed to help churches manage their content, events, and community interactions. The project includes a **web builder** that allows church staff to create and update pages, add banners, post announcements, and engage with members through an easy-to-use interface.

## 🎯 Features

- **Simple Page Template System** – Create and edit church pages using pre-designed templates.
- **Custom CMS System** – Manage content dynamically without coding.
- **Event Management** – Create and promote church events.
- **Form Builder** - Create forms and collect user submissions
- **User Roles & Permissions** – Secure access control for admins, editors, and members.
- **Mobile App Support** – Native mobile app built with Flutter.
- **Mobile Notifications** – Send push notifications for announcements, events, and updates.
- **Bible on Mobile** – Access and read the Bible within the app with an admin manadged Bible reading plan and note taking/highlighting captabilties.
- **Announcements & Bulletins** – Display church updates and messages.
- **Donation & Payment Integration** – Support for online giving via **PayPal**.
- **Multilingual Support** – Accessibility for diverse church communities.


> (some images are zoomed out a great deal to show their full features - since they didn't fit in the screenshot)

### 📋 Admin Interface, Users View
<p align="center">
  <img width="3000" alt="image" src="https://github.com/user-attachments/assets/85cd1a2d-602b-4ec3-b4af-ea5379cfe79d" />
</p>

### 📋 Admin Interface, Creating a new Permission Role
<p align="center">
  <img width="3000" alt="image" src="https://github.com/user-attachments/assets/fe70bbb2-1a2b-4ff2-9ff5-6ceae76fe26c" />
</p>

### 📋 Admin Interface, Creating a new Event
<p align="center">
  <img width="1877" height="1391" alt="image" src="https://github.com/user-attachments/assets/1fca052b-49fb-4acc-acea-5f186f9adeac" />
</p>

### 🔨 Web Builder, Page View
<p align="center">
	<img width="3000" alt="image" src="https://github.com/user-attachments/assets/dd2ce3de-895a-42ae-ad16-bda6e44ac3d9" />
</p>

### 🔨 Web Builder, Header Item Creation
<p align="center">
	<img src="https://github.com/user-attachments/assets/a74ff99c-cc44-40e5-93e8-c90a10dc3010" width="3000" >
</p>

### 🎥 Media Library
<p align="center">
  <img src="https://github.com/user-attachments/assets/86f50bdd-7214-4e7a-b069-858ca33ad2c1" width="3000" >
</p>

### 👤 Login Popup
<p align="center">
  <img src="https://github.com/user-attachments/assets/a3194747-d719-467d-872d-babe77edbbae" width="600" alt="Login">
</p>

### 💻 Web Example
<p align="center">
	<img width="3840" height="8318" alt="image" src="https://github.com/user-attachments/assets/6920316c-aa23-4fb2-b47c-4b769bd259d1" />
</p>

### 📱 Mobile App
<div style="display: flex;">
	<p align="center">
		<img height="600" alt="image" src="https://github.com/user-attachments/assets/d5467605-97bb-4a72-9198-785277bdef35" />
		<img height="600" alt="image" src="https://github.com/user-attachments/assets/6a44e21f-c81a-49f1-b4b0-4bae10f58321" />
		<img height="600" alt="image" src="https://github.com/user-attachments/assets/861c6edd-5d4f-4778-ad05-78b4283df40c" />
		<img height="600" alt="image" src="https://github.com/user-attachments/assets/43f3fb76-5854-4e2f-9746-d4dfd48b4306" />
	</p>
</div>

## 🛠️ Tech Stack

- **Frontend:**  
  - Flutter (Mobile App via the Dart Language)
  - React (Vite + React + TS + Tailwind CSS)

- **Backend:**
	- FaspAPI (Server via the Python Language)

- **Database:**  
  - MongoDB

- **Notifications:**
	- Firebase Cloud Messaging (FCM)

- **Bible Integration:**
	- [Elisha](https://github.com/31Carlton7/elisha)

- **Authentication:**
	- Firebase Auth

- **Payments:**
	- PayPal


Ensure you have the following installed:

- [Node.js](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/) or npm
- [uv](https://docs.astral.sh/uv/)
- [Flutter](https://flutter.dev/) (For mobile development)
- [Docker](https://www.docker.com/) (Optional for database setup)

### Steps

1. **Clone the Repository**
   ```sh
   git clone https://github.com/YOUR_GITHUB/ChurchLink.git
   cd ChurchLink
   ```
   

2.	Install Dependencies in the followig direcotires
	- backend/
	- frontend/web/churchlink
	- frontend/app

4.	Set Up Environment Variables in all direcotires from step 2

4.	Run the Web Frontend (React)
  ```sh
  cd frontend/web
  npm run build && npm run preview
  ```

5.	Run the Mobile App (Flutter)
  ```sh
  cd frontend/app
  flutter run
  ```

7.	Run the Backend (If applicable in the future)
  ```sh
  cd backend
  uv run main.py
  ```

8.	Access the Application
	•	Web App: http://localhost:3000
	•	Mobile App: (Run on emulator or physical device)

## 🔔 Mobile Notifications

ChurchLink supports **push notifications** to keep church members informed about announcements, upcoming events, and other important updates.

- Uses **Firebase Cloud Messaging (FCM)** for push notifications.
- Admins can send notifications from the CMS.
- Users can **opt-in or opt-out** of notifications in their settings.

---

## 📖 Bible on Mobile

ChurchLink will support an **integrated Bible feature** in the future, allowing users to:

- Read the **full Bible** within the app.
- Take notes and highlight passages
- Follow Bible reading plan


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

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.
