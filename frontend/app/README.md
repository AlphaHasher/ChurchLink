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

### **8. Firebase SHA Keys Setup**
To enable Firebase Authentication and other Firebase features, you need to add your app's SHA-1 and SHA-256 fingerprints to the Firebase Console.

#### **For Debug Key**
```sh
cd android
./gradlew signingReport
```
Look for the "debug" configuration in the output. You'll see both SHA-1 and SHA-256 keys.

#### **For Release Key**
For the release key (release-key.jks), use:
```sh
keytool -list -v -keystore app/release-key.jks -alias RandomTestingKey
```
When prompted, enter the keystore password.

#### **Configure Keystore Properties**
Create or edit `android/keystore.properties` to match your keystore settings:
```properties
storeFile=release-key.jks
storePassword=your_store_password
keyAlias=your_key_alias
keyPassword=your_key_password
```
Make sure these values match your actual keystore configuration.

#### **Adding Keys to Firebase Console**
1. Go to the [Link to Project](https://console.firebase.google.com/project/ssbc-9ef2d/settings/general/web:NDkxODllZGItM2ZhMC00YTE2LWIwOTQtNGJiZTM0MzNjMzk2)
3. Go to Project Settings
4. In the "Your apps" section, select your Android app
5. Click "Add fingerprint"
6. Add both SHA-1 and SHA-256 keys for both debug and release configurations

### **9. Troubleshooting**
If you face issues, try running with additional logs:
```sh
flutter run --verbose
```

For more details, check the Flutter documentation: [Flutter Docs](https://flutter.dev/docs).




