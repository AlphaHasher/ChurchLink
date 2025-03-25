import UIKit
import Flutter
import Firebase
import FirebaseMessaging
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate {
  
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    
    FirebaseApp.configure() // ✅ Initialize Firebase

    // Set Firebase Messaging Delegate
    Messaging.messaging().delegate = self
    UNUserNotificationCenter.current().delegate = self

    // Request Notification Permission
    let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
    UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { granted, error in
        if let error = error {
            print("❌ Error requesting notifications permission: \(error.localizedDescription)")
        } else {
            print("✅ Notifications permission granted: \(granted)")
        }
    }

    // Register for Remote Notifications
    application.registerForRemoteNotifications()

    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  // ✅ Handle Notifications when App is in Foreground
  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
      completionHandler([.alert, .sound, .badge])
  }
}

// ✅ Extension for Firebase Messaging Delegate
extension AppDelegate: MessagingDelegate {
  
  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
      print("✅ FCM Token: \(fcmToken ?? "No Token")")
  }
}
