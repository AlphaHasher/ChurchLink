# 📺 SSBC Mobile App

Welcome to the **SSBC Mobile App** repository! 🚀  
This guide will help you **clone the project, set it up, and start coding**.

---

## 📂 Clone This Repository
To start working on this project, open your terminal and run:
```sh
git clone https://github.com/YOUR-USERNAME/ssbc-mobileapp.git
cd ssbc-mobileapp
```

---

## 🔧 Prerequisites
Before running the project, ensure you have the following installed:

### 1️⃣ Install Flutter
- Download & install Flutter: [Flutter Install Guide](https://flutter.dev/docs/get-started/install)
- Verify Flutter installation:
  ```sh
  flutter doctor
  ```

### 2️⃣ Install Dependencies
Run the following command inside the project directory:
```sh
flutter pub get
```

### 3️⃣ Setup Firebase
- Go to [Firebase Console](https://console.firebase.google.com/)
- Add **Android & iOS** apps to Firebase
- Download the following files and place them correctly:
  - **Android:** `google-services.json` → `android/app/`
  - **iOS:** `GoogleService-Info.plist` → `ios/Runner/`
- Enable Firebase products: Authentication, Firestore, Messaging (if used).

---

## 🚀 Running the App
### **Android (Emulator or Device)**
```sh
flutter run
```
### **iOS (Mac Users Only)**
```sh
cd ios
pod install
cd ..
flutter run
```

---

## ⚡ Common Issues & Fixes
#### 1️⃣ App Crashes on Start
- Run:
  ```sh
  flutter clean && flutter pub get
  ```
- Check Firebase setup and ensure `google-services.json` is in `android/app/`.

#### 2️⃣ Android Firebase Issues
- Open `android/app/build.gradle` and make sure:
  ```gradle
  apply plugin: 'com.google.gms.google-services'
  ```
- Then, **clean & rebuild**:
  ```sh
  cd android && ./gradlew clean && cd ..
  ```

#### 3️⃣ iOS Build Issues
- Run:
  ```sh
  cd ios
  pod install
  ```

---

## 💚 Branching & Contribution Guide
### 1️⃣ Create a New Feature Branch
```sh
git checkout -b feature/your-feature-name
```

### 2️⃣ Commit Your Changes
```sh
git add .
git commit -m "Added new feature"
```

### 3️⃣ Push to Remote
```sh
git push origin feature/your-feature-name
```

### 4️⃣ Create a Pull Request on GitHub
Go to **GitHub → Your Repository → Pull Requests**  
Click **"New Pull Request"** and select your branch.

---

## 📞 Need Help?
- Ask in the **team Slack** or **GitHub Issues**
- Check the **Flutter & Firebase docs**
- Run:
  ```sh
  flutter doctor
  ```

Happy coding! 🎉🚀

