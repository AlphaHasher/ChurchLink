<p align="center">
  <img src="https://github.com/user-attachments/assets/feb41274-e2a4-450a-af58-7164c9ecbfb3" width="75%">
</p>

## 📌 Overview

**ChurchLink** is a web and mobile platform designed to help churches manage their content, events, and community interactions. The project includes a **web builder** that allows church staff to create and update pages, add banners, post announcements, and engage with members through an easy-to-use interface.

## 🎯 Features

- **Simple Page Template System** – Create and edit church pages using pre-designed templates.
- **Custom CMS System** – Manage content dynamically without coding.
- **Feature-Rich Web Builder** – Allows the user to create and manage pages alongside changing the layout of the website
- **Event Management** – Create and promote church events.
- **Form Builder** - Create forms and collect user submissions
- **User Roles & Permissions** – Secure access control for admins, editors, and members.
- **Mobile App Support** – Native mobile app built with Flutter.
- **Mobile Notifications** – Send push notifications for announcements, events, and updates.
- **Bible on Mobile** – Access and read the Bible within the app with an admin manadged Bible reading plan and note taking/highlighting captabilties.
- **Announcements & Bulletins** – Display church updates and messages.
- **Donation & Payment Integration** – Support for online giving via **PayPal**. See [PayPal Setup Guide](PAYPAL_SETUP_GUIDE.md) for configuration.
- **Multilingual Support** – Accessibility for diverse church communities.

## 🏦 PayPal Integration Setup

For detailed PayPal integration setup instructions, see our comprehensive guide:
**[📖 PayPal Setup Guide](PAYPAL_SETUP_GUIDE.md)**


> (some images are zoomed out a great deal to show their full features - since they didn't fit in the screenshot)

### 📋 Admin Interface, Users View
<p align="center">
  <img width="3000" alt="image" src="https://github.com/user-attachments/assets/85cd1a2d-602b-4ec3-b4af-ea5379cfe79d" />
</p>

### 📋 Admin Interface, Creating a new Permission Role
<p align="center">
  <img width="3000" alt="image" src="https://github.com/user-attachments/assets/b1edb894-cee8-4abe-ac52-31d19a8c0d01" />
</p>


### 📋 Admin Interface, Creating a new Event
<p align="center">
  <img width="1877" height="1391" alt="image" src="https://github.com/user-attachments/assets/15ac319d-4625-4d54-b0bf-c368d9370dbd" />
</p>

### 🔨 Web Builder, Page Builder View
<p align="center">
	<img width="3000" alt="image" src="https://github.com/user-attachments/assets/9b189a4b-afe9-421e-8a7e-123275d4381b" />
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

### 💻 Web Example, A Real Page Created in our Builder
<p align="center">
	<img width="3840" height="8318" alt="image" src="https://github.com/user-attachments/assets/328a8518-6a7b-47c4-85ac-5b5029deedaf" />
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
	- FastAPI (Server via the Python Language)

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

3.	Set Up Environment Variables in all directories from step 2

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

---
## 👥 Project Contributors and How to Contact Us

### Daniel Agafanov
Personal Email Address: agdaniel7@gmail.com

Phone Number: 916-696-4743

### Jaden Bruha
Personal Email Address: jadenbruha@gmail.com

Phone Number: 209-417-0913

### Andrew Coats
Personal Email Address: dedicatedpanda@gmail.com

Phone Number: 916-824-5765

### Dylan Cochran
Personal Email Address: dylancochran629@gmail.com

Phone Number (Preferred): (530)301-8059

### Gabriel Malek
Personal Email Address: malek.gabriel33@gmail.com

Phone Number: (978) 873-0012

### Rylan Pereira
Personal Email Address: rylanrpcollege@gmail.com

Phone Number: 707-386-8004

### Tai Pham
Personal Email Address: taipham164@gmail.com

Phone Number: 279-203-1957

---

## 📖 Documentation and Manuals

[You may find a link to a Google Drive folder that contains well over 500 pages of documentation by clicking here!](https://drive.google.com/drive/folders/1iROJdqdsG2-M1OJ6CPjaXgic_Ft5GZUn?usp=drive_link)

This link includes a System Test Report with instructions on how to test,

A Maintenance Manual with instructions on how to deploy and keep the project running,

And a User Manual to explain how you may use our project all in great detail!

---

## 🔔 Mobile Notifications

ChurchLink supports **push notifications** to keep church members informed about announcements, upcoming events, and other important updates.

- Uses **Firebase Cloud Messaging (FCM)** for push notifications.
- Admins can send notifications from the CMS.
- Users can **opt-in or opt-out** of notifications in their settings.

---

## 📖 Bible on Mobile

ChurchLink supports an **integrated Bible reader**, allowing users to:

- Read the **full Bible** within the app.
- Take notes and highlight passages
- Follow Bible reading plans


---

## 💳 Donations & Payments

ChurchLink supports **online donations** through **PayPal**, allowing churches to accept **tithes and offerings** digitally.

- Integrated with **PayPal API** for secure transactions.
- Allows **one-time or recurring** donations.

---

## ⚙️ Permissions Currently Implemented

ChurchLink supports permissions implemented by the means of **user-defined permission roles.** Below is the list of permissions that can be implemented into permission roles:

- admin: Allows the user to have complete permissions access. Only able to be granted to default Administrator role. Allows for creation/edit/deletion of roles with permissions_management perm.

- permissions_management: Allows this user to be able to create/edit/delete/assign roles. Special rule: These users cannot edit roles with the admin or permissions management permissions. These users cannot change permissions they do not already explicitly have permissions for.

- web_builder_management: Allows the user to be able to create and manage web pages, the web layout, and settings for the web.

- mobile_ui_management: Allows the user to control the mobile Bottom NavBar and the Dashboard tiles to fine-tune their users UX

- event_editing: Allows this user to be able to create/edit/delete events and their instances alongside managing registrants of events

- media_management: Allows this user to be able to upload/edit/delete media content and folders in our custom CMS implementation

- sermon_editing: Allows the user to be able to upload links to YouTube uploaded Sermons for the end users to see

- bulletin_editing: Allows this user to be able to edit the weekly bulletin

- finance: Allows this user permission to access the financial pages including viewing and managing transactions, refund requests, and financial reports

- ministries_management: Allows the user to create, edit, and delete ministries. An organizational categorical tool that can be applied to various data types

- forms_management: Allows the user to create and manage forms alongside viewing their responses

- bible_plan_management: Allows the user to be able to create and manage bible reading plans

- notification_management: Allows the user to be able to publish and schedule push notifications for end-users

---

## 📊 Database Design

We have approximately 40 different Database collections, so it is impractical to give you a full diagram to be able to understand the full database all at once. For a greater view of our database design, please view our link for manuals & documentation, check the maintenance manual, and visit section 6.

Here are some examples of tables depicting some of the most important Database collection items and how they interact with each other:

<img width="2495" height="1350" alt="image" src="https://github.com/user-attachments/assets/ca683914-cb7a-4865-9065-4ba34a77f3af" />

<img width="1331" height="1044" alt="image" src="https://github.com/user-attachments/assets/eda560e4-d1c6-498e-a2d0-abaeae189dfe" />

<img width="2508" height="1391" alt="image" src="https://github.com/user-attachments/assets/a6e85570-847c-4405-a55f-0bf48aaeadc6" />

<img width="2556" height="1376" alt="image" src="https://github.com/user-attachments/assets/bea5f5ac-71b8-4c52-b506-d39b725ce155" />

<img width="1918" height="1375" alt="image" src="https://github.com/user-attachments/assets/59b8964e-dedf-45a5-8b7f-ca7492dccd92" />

<img width="772" height="1117" alt="image" src="https://github.com/user-attachments/assets/b410c977-a047-443a-a6cf-f3e322e69836" />

<img width="763" height="849" alt="image" src="https://github.com/user-attachments/assets/6a57f41c-dca8-4bed-ab53-dd6c54c10dcd" />

<img width="1465" height="1034" alt="image" src="https://github.com/user-attachments/assets/bae03510-708b-4491-9c8b-8958162f9bc8" />

<img width="2172" height="1138" alt="image" src="https://github.com/user-attachments/assets/3ec8824e-5819-437b-9be3-f8470f0b4258" />

<img width="975" height="589" alt="image" src="https://github.com/user-attachments/assets/43eca710-baf2-49f1-a3ad-6f692b9c6a1c" />

<img width="2454" height="1226" alt="image" src="https://github.com/user-attachments/assets/979dc7b5-2e54-40ef-a123-54476df7e7f0" />

<img width="2120" height="1378" alt="image" src="https://github.com/user-attachments/assets/e4b208da-5d75-450e-a55c-fb9b67b84b39" />

<img width="1981" height="1070" alt="image" src="https://github.com/user-attachments/assets/b970db51-7cd5-44d4-b2ec-6ad945910391" />

<img width="1981" height="1070" alt="image" src="https://github.com/user-attachments/assets/5f93c967-906c-4e36-8d36-4c3fe4713d2a" />

---

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.
