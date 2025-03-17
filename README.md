# ChurchLink

## 📌 Overview

**ChurchLink** is a web and mobile platform designed to help churches manage their content, events, and community interactions. The project includes a **web builder** that allows church staff to create and update pages, add banners, post announcements, and engage with members through an easy-to-use interface.

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

## 🛠️ Tech Stack

- **Frontend:**  
  - **Flutter (Mobile App)**  
  - **React (Web App)**  

- **Backend:** *(To be determined)*  

- **CMS:** Strapi (or alternative)  

- **Database:**  
  - **MongoDB** (Main Database)  
  - **SQLite** (For CMS)  

- **Notifications:** Firebase Cloud Messaging (FCM)  

- **Bible Integration:** *(To be determined)*  

- **Hosting:** Firebase / AWS  

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

## 🤝 Contributing

We welcome contributions from the community! If you’d like to contribute:

1. **Fork** the repository and create a **new branch**.
2. **Make your changes** and ensure the project runs successfully.
3. **Submit a pull request** for review.

---

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.
