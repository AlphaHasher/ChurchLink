import java.util.Properties
import java.io.FileInputStream

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()

// Load properties file if it exists, otherwise just continue without loading
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "churchlink.ssbc"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = "29.0.14206865"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    tasks.withType<JavaCompile>().configureEach {
        options.compilerArgs.add("-Xlint:-options")
    }

    defaultConfig {
        applicationId = "churchlink.ssbc"
        minSdk = flutter.minSdkVersion
        targetSdk = 34
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        multiDexEnabled = true
        testInstrumentationRunner = "pl.leancode.patrol.PatrolJUnitRunner"
        testInstrumentationRunnerArguments["clearPackageData"] = "true"

    }

    signingConfigs {
        create("release") {
            val keyStoreFile = file(keystoreProperties.getProperty("storeFile", "release-key.jks"))
            if (!keyStoreFile.exists()) {
                logger.error("Key store file ${keyStoreFile.absolutePath} not found - please read frontend/app/README.md for instructions on how to generate Firebase SHA keys")
            }
            storeFile = keyStoreFile
            storePassword = keystoreProperties.getProperty("storePassword", "potato")
            keyAlias = keystoreProperties.getProperty("keyAlias", "RandomTestingKey")
            keyPassword = keystoreProperties.getProperty("keyPassword", "potato")
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    testOptions {
        execution = "ANDROIDX_TEST_ORCHESTRATOR"
    }

}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    androidTestUtil("androidx.test:orchestrator:1.5.1")
    implementation(platform("com.google.firebase:firebase-bom:34.6.0"))
}

flutter {
    source = "../.."
}
