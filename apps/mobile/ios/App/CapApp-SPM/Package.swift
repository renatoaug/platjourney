// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.3"),
        .package(name: "CapacitorHaptics", path: "../../../../../node_modules/.bun/@capacitor+haptics@8.0.2+9cf34ba37901b220/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorSplashScreen", path: "../../../../../node_modules/.bun/@capacitor+splash-screen@8.0.2+9cf34ba37901b220/node_modules/@capacitor/splash-screen"),
        .package(name: "CapgoCapacitorSpeechRecognition", path: "../../../../../node_modules/.bun/@capgo+capacitor-speech-recognition@8.4.3+9cf34ba37901b220/node_modules/@capgo/capacitor-speech-recognition")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorSplashScreen", package: "CapacitorSplashScreen"),
                .product(name: "CapgoCapacitorSpeechRecognition", package: "CapgoCapacitorSpeechRecognition")
            ]
        )
    ]
)
