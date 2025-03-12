## Getting Started

This repository contains the SSBC Mobile App. Follow the steps below to set up the project on your local machine.

### **1. Clone the Repository**


### **2. Install Dependencies**
```sh
flutter pub get
```

### **3. Setup Firebase**
Ensure that your Firebase configuration files (`google-services.json` for Android, `GoogleService-Info.plist` for iOS) are placed in the appropriate directories.

### **4. Update Android Settings**
#### **Increase minSdkVersion to 23**
Modify `android/app/build.gradle` and update the `defaultConfig`:
```gradle
android {
    defaultConfig {
        minSdkVersion 23
        targetSdkVersion 34
    }
}
```

### **5. Fix Android NDK Issue**
If you encounter an error related to the **NDK source.properties file**, follow these steps:
#### **Check Installed NDK Versions**
```sh
ls -la ~/Library/Android/sdk/ndk/
```
#### **Reinstall the Correct NDK Version**
```sh
sdkmanager --install "ndk;27.0.12077973"
```
If `sdkmanager` is not found, install Android Command Line Tools:
```sh
brew install --cask android-commandlinetools
```
Then run:
```sh
sdkmanager --install "ndk;27.0.12077973"
```

### **6. Run the App**
```sh
flutter run
```

### **7. Additional Commands**
#### **Clean Project**
```sh
flutter clean
flutter pub get
```
#### **Check Installed Flutter Version**
```sh
flutter doctor
```

### **8. Troubleshooting**
If you face issues, try running with additional logs:
```sh
flutter run --verbose
```

For more details, check the Flutter documentation: [Flutter Docs](https://flutter.dev/docs).

