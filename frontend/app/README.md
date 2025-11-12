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
YOU NEED ADD THE DEBUG KEY TO CONSOLE NOT BUILD

#### **For Debug Key**
```sh
cd android
./gradlew signingReport
```
Look for the "debug" configuration in the output. You'll see both SHA-1 and SHA-256 keys.


#### **Adding Keys to Firebase Console**
1. Go to the [Link to Project](https://console.firebase.google.com/project/ssbc-9ef2d/settings/general/web:NDkxODllZGItM2ZhMC00YTE2LWIwOTQtNGJiZTM0MzNjMzk2)
3. Go to Project Settings
4. In the "Your apps" section, select your Android app
5. Click "Add fingerprint"
6. Add both SHA-1 and SHA-256 keys for both debug and release configurations

#### **Configure Keystore Properties**
Create or edit `android/keystore.properties` to match your keystore settings:
```properties
storeFile=release-key.jks
storePassword=your_store_password
keyAlias=your_key_alias
keyPassword=your_key_password
```
Make sure these values match your actual keystore configuration.

#### **Generating Release Key**

In order to generate a release-key.jks file run this command in the terminal:

```sh
keytool -genkey -v -keystore android/app/release-key.jks -alias RandomTestingKey -keyalg RSA -keysize 2048 -validity 10000
```
When prompted, enter the keystore password and other details from your keystore.properties file.

In order to get the SHA keys, use this command
```sh
keytool -list -v -keystore app/release-key.jks -alias RandomTestingKey
```
Don't forget to add them to the Firebase Console (same place as the debug key - instructions above)

### **9. Troubleshooting**
If you face issues, try running with additional logs:
```sh
flutter run --verbose
```

For more details, check the Flutter documentation: [Flutter Docs](https://flutter.dev/docs).

### **10. Integrated Testing (Patrol + Flutter Integration Tests)**
This project includes a fully integrated UI testing setup using
Patrol and Flutter’s built-in integration_test framework.
Patrol allows Flutter UI tests to interact with both Flutter widgets
and native Android/iOS elements (e.g. permission dialogs, notifications, WebViews).

*** Note ***
IOS patrol testing is currently unimplemented due to not having a proper testing
environment to implement on available. Android emulator only.

#### Install Patrol CLI
`code dart pub global activate patrol_cli code`

#### Ensure Patrol is correctly working
`patrol doctor`

#### Example / Template Test
Included in integration_test is example_test.dart, this is a basic test that will
always pass. Can be used as a template for other tests

#### How to run a Patrol Test
`patrol test --target integration_test --dart-define=TEST_MODE=true`
This command assumes you are running it from frontend/app, the last flag
of the command is necessary for it to run correctly, do not omit it.


### **11. Setting App Image And Name**

#### App Name

1. `.env` - APP_NAME
2. `AndroidManifest.xml` - android:label
3. `AppFrameworkInfo.plist`:
    ```yaml
    <key>CFBundleName</key>
    <string>App Name Goes Here</string>
    ```

#### App Image

Using the [flutter_launcher_icons](https://pub.dev/packages/flutter_launcher_icons) package

1. Setup `pubspec.yaml`
```
flutter_launcher_icons:
  android: true
  ios: true
  remove_alpha_ios: true
  image_path: "assets/user/AppLogo.png"
```
2. run `dart run flutter_launcher_icons`
3. Build app as your would normally, and that's it!